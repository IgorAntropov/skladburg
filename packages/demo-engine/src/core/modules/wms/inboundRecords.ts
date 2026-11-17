import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  type ReceivingTask,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { ReceivingTasksChangedSchema } from '@skladburg/contracts/wms/v1/receiving_events';

import type { IDomainErrors } from '../../errors/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { WarehouseStockRecordValue } from '../../state/records';
import type { IModuleRuntime } from '../moduleRuntime';

import { compareIds } from '../../state/index';
import {
  isInboundYardBlocked,
  readInboundYardGate,
} from './inboundYardGate';
import {
  readEffectiveWarehouseDockIds,
  readOwnedWarehouseTopology,
} from './warehouseTopologyRecords';

interface InboundDockScopeValue {
  receivingAreaId: string;
  tenantId: string;
  warehouseId: string;
}

const readDockIds = (
  reader: IStateReader,
  errors: IDomainErrors,
  { receivingAreaId, tenantId, warehouseId }: InboundDockScopeValue,
): Set<string> => {
  const area = readOwnedWarehouseTopology(reader, errors, warehouseId, tenantId)?.receivingArea;
  if (area?.id !== receivingAreaId) {
    return new Set();
  }
  return new Set(readEffectiveWarehouseDockIds(area));
};

const isActiveInboundTask = (task: ReceivingTask, receivingAreaId: string): boolean =>
  task.receivingAreaId === receivingAreaId && (task.status === ReceivingTaskStatus.OPEN || task.status === ReceivingTaskStatus.IN_PROGRESS);

export const requireInboundDock = (
  reader: IStateReader,
  errors: IDomainErrors,
  task: ReceivingTask,
  tenantId: string,
  command: string,
): void => {
  const ids = readDockIds(reader, errors, { ...task, tenantId });
  const hasDockAssignment = task.unloadingPointId !== undefined && ids.has(task.unloadingPointId);
  const isSingleDockOccupied = ids.size === 1 && !hasDockAssignment
    && reader.listBy('warehouseInbound', 'scopeId', task.warehouseId).some((record) => {
      if (record.id === task.id || record.lookupKey !== tenantId) {
        return false;
      }
      const other = readInboundTask(record, errors);
      return isActiveInboundTask(other, task.receivingAreaId) && other.unloadingPointId !== undefined && ids.has(other.unloadingPointId);
    });
  const isWaitingDock = task.yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCK
    || (!hasDockAssignment && (ids.size > 1 || isSingleDockOccupied));
  if (isWaitingDock || isInboundYardBlocked(readInboundYardGate(reader, task, tenantId))) {
    throw errors.invalidTransition(EntityKind.RECEIVING_TASK, ReceivingTaskStatus[task.status], command);
  }
};

export const readInboundTask = (record: WarehouseStockRecordValue, errors: IDomainErrors): ReceivingTask => {
  const task = fromBinary(ReceivingTaskSchema, record.bytes);
  if (task.id !== record.id || task.dealId !== record.id || task.warehouseId !== record.scopeId
    || task.receivingAreaId === '' || task.orderLines.length === 0 || task.expectedUnits.length === 0) {
    throw errors.internal();
  }

  return task;
};

export const saveInboundTask = (
  transaction: IStateTransaction,
  runtime: Pick<IModuleRuntime, 'outbox'>,
  task: ReceivingTask,
  tenantId: string,
): void => {
  transaction.put('warehouseInbound', {
    bytes: toBinary(ReceivingTaskSchema, task),
    id: task.id,
    lookupKey: tenantId,
    scopeId: task.warehouseId,
  });

  if (task.version > 0) {
    runtime.outbox.add(transaction, tasksChannel(task.warehouseId), {
      case: 'receivingTasksChanged',
      value: create(ReceivingTasksChangedSchema, { warehouseId: task.warehouseId }),
    });
  }
};

export const assignAvailableInboundDocks = (
  transaction: IStateTransaction,
  runtime: Pick<IModuleRuntime, 'errors' | 'outbox'>,
  scope: InboundDockScopeValue,
  updatedTask?: ReceivingTask,
): void => {
  const dockIds = readDockIds(transaction, runtime.errors, scope);
  if (dockIds.size === 0) {
    return;
  }
  if (updatedTask?.yardAdmissionStatus === YardAdmissionStatus.ADMITTED
    && (updatedTask.unloadingPointId === undefined || !dockIds.has(updatedTask.unloadingPointId))) {
    updatedTask.yardAdmissionStatus = YardAdmissionStatus.WAITING_DOCK;
  }
  const available = new Set(dockIds);
  const waiting: { arrivedAt: number; task: ReceivingTask }[] = [];
  for (const record of transaction.listBy('warehouseInbound', 'scopeId', scope.warehouseId)) {
    if (record.lookupKey !== scope.tenantId) {
      continue;
    }
    const task = record.id === updatedTask?.id ? updatedTask : readInboundTask(record, runtime.errors);
    if (!isActiveInboundTask(task, scope.receivingAreaId) || isInboundYardBlocked(readInboundYardGate(transaction, task, scope.tenantId))) {
      continue;
    }
    if (task.unloadingPointId !== undefined && dockIds.has(task.unloadingPointId)) {
      available.delete(task.unloadingPointId);
    }
    else if (task.version < 2_147_483_647) {
      const arrived = transaction.get('deals', task.dealId)?.transitions.find(transition => transition.to === DealStatus.ARRIVED)?.at;
      waiting.push({ arrivedAt: arrived === undefined ? 0 : timestampMs(arrived), task });
    }
  }

  waiting.sort((current, prev) => {
    const hasReceipt = current.task.receivedUnits.length > 0;
    const hadReceipt = prev.task.receivedUnits.length > 0;
    return Number(hadReceipt) - Number(hasReceipt) || current.arrivedAt - prev.arrivedAt || compareIds(current.task.id, prev.task.id);
  });
  let index = 0;
  for (const dockId of available) {
    const assignment = waiting[index++];
    if (assignment === undefined) {
      break;
    }
    assignment.task.unloadingPointId = dockId;
    if (assignment.task.yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCK) {
      assignment.task.yardAdmissionStatus = YardAdmissionStatus.ADMITTED;
    }
    if (assignment.task !== updatedTask) {
      assignment.task.version += 1;
      saveInboundTask(transaction, runtime, assignment.task, scope.tenantId);
    }
  }
};

export const openInboundTask = (transaction: IStateTransaction, runtime: IModuleRuntime, dealId: string): void => {
  const record = transaction.get('warehouseInbound', dealId);
  if (record === undefined) {
    return;
  }
  const task = readInboundTask(record, runtime.errors);
  if (task.status !== ReceivingTaskStatus.UNSPECIFIED || task.version !== 0) {
    throw runtime.errors.internal();
  }

  task.status = ReceivingTaskStatus.OPEN;
  task.version = 1;
  task.yardAdmissionStatus = readInboundYardGate(transaction, task, record.lookupKey);
  assignAvailableInboundDocks(transaction, runtime, { ...task, tenantId: record.lookupKey }, task);
  saveInboundTask(transaction, runtime, task, record.lookupKey);
};

export const refreshInboundYardAdmission = (transaction: IStateTransaction, runtime: IModuleRuntime, dealId: string): void => {
  const record = transaction.get('warehouseInbound', dealId);
  if (record === undefined) {
    return;
  }

  const task = readInboundTask(record, runtime.errors);
  if (task.status !== ReceivingTaskStatus.OPEN && task.status !== ReceivingTaskStatus.IN_PROGRESS) {
    return;
  }

  const status = readInboundYardGate(transaction, task, record.lookupKey);
  if (status === task.yardAdmissionStatus) {
    return;
  }
  if (task.version >= 2_147_483_647) {
    throw runtime.errors.unavailable();
  }

  task.version += 1;
  task.yardAdmissionStatus = status;
  assignAvailableInboundDocks(transaction, runtime, { ...task, tenantId: record.lookupKey }, task);
  saveInboundTask(transaction, runtime, task, record.lookupKey);
};

export const hasInboundProduct = (reader: IStateReader, errors: IDomainErrors, tenantId: string, productId: string): boolean =>
  reader.listBy('warehouses', 'tenantId', tenantId).some(warehouse =>
    reader.listBy('warehouseInbound', 'scopeId', warehouse.id).some(record =>
      record.lookupKey === tenantId && readInboundTask(record, errors).orderLines.some(line => line.productId === productId)));
