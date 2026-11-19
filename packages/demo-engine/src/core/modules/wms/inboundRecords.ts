import type { TransportCargo } from '@skladburg/contracts/logistics/v1/logistics_records';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
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
import type {
  InboundCargoRequirementsValue,
  InboundDockValue,
} from './inboundDockQueue';

import { compareIds } from '../../state/index';
import { readTripForDeal } from '../logistics/tripRecords';
import {
  canUseInboundDock,
  matchInboundDockQueue,
} from './inboundDockQueue';
import {
  isInboundYardBlocked,
  readInboundYardGate,
} from './inboundYardGate';
import {
  readEffectiveWarehouseDocks,
  readOwnedWarehouseTopology,
} from './warehouseTopologyRecords';

interface InboundDockCandidateValue extends InboundCargoRequirementsValue {
  arrivedAt: number;
  deliveryEndsAt: number;
  task: ReceivingTask;
}

interface InboundDockScopeValue {
  receivingAreaId: string;
  tenantId: string;
  warehouseId: string;
}

const readCargoRequirements = (cargo: TransportCargo | undefined): InboundCargoRequirementsValue => ({
  hasColdCargo: cargo?.cargoKind === VehicleCargoKind.TEMPERATURE_CONTROLLED || cargo?.temperature !== undefined,
  hasOversizeCargo: cargo?.cargoKind === VehicleCargoKind.OVERSIZE,
});

const readInboundDocks = (
  reader: IStateReader,
  errors: IDomainErrors,
  { receivingAreaId, tenantId, warehouseId }: InboundDockScopeValue,
): InboundDockValue[] => {
  const area = readOwnedWarehouseTopology(reader, errors, warehouseId, tenantId)?.receivingArea;
  if (area?.id !== receivingAreaId) {
    return [];
  }

  const docks = readEffectiveWarehouseDocks(area);
  const warehouseCapabilities = docks.length === 1 ? reader.get('warehouses', warehouseId)?.capabilities : undefined;
  return docks.map(({ capabilities, id }) => {
    const supported = capabilities.length === 0 ? warehouseCapabilities : capabilities;
    return {
      canHandleOversize: supported?.includes(WarehouseCapability.OVERSIZE) === true,
      hasColdZone: supported?.includes(WarehouseCapability.COLD) === true,
      id,
    };
  });
};

const isActiveInboundTask = (task: ReceivingTask, receivingAreaId: string): boolean =>
  task.receivingAreaId === receivingAreaId && (task.status === ReceivingTaskStatus.OPEN || task.status === ReceivingTaskStatus.IN_PROGRESS);

const hasLegacyReceipts = (task: ReceivingTask): boolean =>
  task.yardAdmissionStatus === YardAdmissionStatus.UNSPECIFIED && task.receivedUnits.length > 0;

export const requireInboundDock = (
  reader: IStateReader,
  errors: IDomainErrors,
  task: ReceivingTask,
  tenantId: string,
  command: string,
): void => {
  const docks = readInboundDocks(reader, errors, { ...task, tenantId });
  const hasDockAssignment = docks.some(dock => dock.id === task.unloadingPointId);
  const onlyDock = docks.length === 1 ? docks[0] : undefined;
  const isSingleDockOccupied = onlyDock !== undefined && !hasDockAssignment
    && reader.listBy('warehouseInbound', 'scopeId', task.warehouseId).some((record) => {
      if (record.id === task.id || record.lookupKey !== tenantId) {
        return false;
      }
      const other = readInboundTask(record, errors);
      return isActiveInboundTask(other, task.receivingAreaId) && other.unloadingPointId === onlyDock.id;
    });
  const isSingleDockIncompatible = onlyDock !== undefined && !hasDockAssignment && !hasLegacyReceipts(task)
    && !canUseInboundDock(onlyDock, readCargoRequirements(readTripForDeal(reader, task.dealId)?.transportOrder?.cargo));
  const isWaitingDock = task.yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCK
    || (!hasDockAssignment && (docks.length > 1 || isSingleDockOccupied || isSingleDockIncompatible));
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
  reservedDockIds?: ReadonlySet<string>,
): void => {
  const docks = readInboundDocks(transaction, runtime.errors, scope);
  if (docks.length === 0) {
    return;
  }
  const available = new Map(docks.map(dock => [dock.id, dock] as const));
  if (reservedDockIds !== undefined) {
    for (const dockId of reservedDockIds) {
      available.delete(dockId);
    }
  }
  if (updatedTask?.yardAdmissionStatus === YardAdmissionStatus.ADMITTED
    && (updatedTask.unloadingPointId === undefined || !available.has(updatedTask.unloadingPointId))) {
    updatedTask.yardAdmissionStatus = YardAdmissionStatus.WAITING_DOCK;
  }
  const waiting: InboundDockCandidateValue[] = [];
  for (const record of transaction.listBy('warehouseInbound', 'scopeId', scope.warehouseId)) {
    if (record.lookupKey !== scope.tenantId) {
      continue;
    }
    const task = record.id === updatedTask?.id ? updatedTask : readInboundTask(record, runtime.errors);
    if (!isActiveInboundTask(task, scope.receivingAreaId) || isInboundYardBlocked(readInboundYardGate(transaction, task, scope.tenantId))) {
      continue;
    }
    if (task.unloadingPointId !== undefined && docks.some(dock => dock.id === task.unloadingPointId)) {
      available.delete(task.unloadingPointId);
    }
    else if (task.version < 2_147_483_647) {
      const deal = transaction.get('deals', task.dealId);
      const trip = readTripForDeal(transaction, task.dealId);
      const order = trip?.transportOrder;
      const arrived = trip?.arrivedAt ?? deal?.transitions.find(transition => transition.to === DealStatus.ARRIVED)?.at;
      const deliveryEnd = order?.deliveryWindow?.endsAt;
      waiting.push({
        arrivedAt: arrived === undefined ? 0 : timestampMs(arrived),
        deliveryEndsAt: deliveryEnd === undefined ? Number.MAX_SAFE_INTEGER : timestampMs(deliveryEnd),
        ...readCargoRequirements(docks.length === 1 && hasLegacyReceipts(task) ? undefined : order?.cargo),
        task,
      });
    }
  }

  waiting.sort((current, prev) => {
    const hasReceipt = current.task.receivedUnits.length > 0;
    const hadReceipt = prev.task.receivedUnits.length > 0;
    return Number(hadReceipt) - Number(hasReceipt)
      || Number(prev.hasColdCargo) - Number(current.hasColdCargo)
      || current.deliveryEndsAt - prev.deliveryEndsAt
      || current.arrivedAt - prev.arrivedAt
      || compareIds(current.task.id, prev.task.id);
  });
  for (const [dockId, { task }] of matchInboundDockQueue([...available.values()], waiting)) {
    task.unloadingPointId = dockId;
    if (task.yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCK) {
      task.yardAdmissionStatus = YardAdmissionStatus.ADMITTED;
    }
    if (task !== updatedTask) {
      task.version += 1;
      saveInboundTask(transaction, runtime, task, scope.tenantId);
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
