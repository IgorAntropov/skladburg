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
  if (area?.id !== receivingAreaId || area.additionalUnloadingPoints.length === 0) {
    return new Set();
  }
  return new Set(readEffectiveWarehouseDockIds(area));
};

export const requireInboundDock = (
  reader: IStateReader,
  errors: IDomainErrors,
  task: ReceivingTask,
  tenantId: string,
  command: string,
): void => {
  const ids = readDockIds(reader, errors, { ...task, tenantId });
  if (ids.size > 1 && (task.unloadingPointId === undefined || !ids.has(task.unloadingPointId))) {
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
  if (dockIds.size < 2) {
    return;
  }
  const available = new Set(dockIds);
  const waiting: { arrivedAt: number; task: ReceivingTask }[] = [];
  for (const record of transaction.listBy('warehouseInbound', 'scopeId', scope.warehouseId)) {
    if (record.lookupKey !== scope.tenantId) {
      continue;
    }
    const task = record.id === updatedTask?.id ? updatedTask : readInboundTask(record, runtime.errors);
    if (task.receivingAreaId !== scope.receivingAreaId
      || (task.status !== ReceivingTaskStatus.OPEN && task.status !== ReceivingTaskStatus.IN_PROGRESS)) {
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

  waiting.sort((current, prev) => current.arrivedAt - prev.arrivedAt || compareIds(current.task.id, prev.task.id));
  let index = 0;
  for (const dockId of available) {
    const assignment = waiting[index++];
    if (assignment === undefined) {
      break;
    }
    assignment.task.unloadingPointId = dockId;
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
  assignAvailableInboundDocks(transaction, runtime, { ...task, tenantId: record.lookupKey }, task);
  saveInboundTask(transaction, runtime, task, record.lookupKey);
};

export const hasInboundProduct = (reader: IStateReader, errors: IDomainErrors, tenantId: string, productId: string): boolean =>
  reader.listBy('warehouses', 'tenantId', tenantId).some(warehouse =>
    reader.listBy('warehouseInbound', 'scopeId', warehouse.id).some(record =>
      record.lookupKey === tenantId && readInboundTask(record, errors).orderLines.some(line => line.productId === productId)));
