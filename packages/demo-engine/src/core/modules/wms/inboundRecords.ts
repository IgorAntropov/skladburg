import type { TransportCargo } from '@skladburg/contracts/logistics/v1/logistics_records';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  ReceivingDockScheduleSchema,
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
import type { InboundDockCandidateValue } from './inboundDockSchedule';
import type { InboundDockSlotValue } from './inboundDockSlots';

import { compareIds } from '../../state/index';
import { readTripForDeal } from '../logistics/tripRecords';
import {
  canUseInboundDock,
  matchInboundDockQueue,
} from './inboundDockQueue';
import {
  assignInboundDock,
  assignScheduledInboundDocks,
  readInboundDockReservation,
} from './inboundDockSchedule';
import { INBOUND_DOCK_SLOT_GRACE_MS } from './inboundDockSlots';
import {
  isInboundYardBlocked,
  readInboundYardGate,
} from './inboundYardGate';
import { usesOutboundDock } from './outboundDockOccupancy';
import {
  readEffectiveWarehouseDocks,
  readOwnedWarehouseTopology,
} from './warehouseTopologyRecords';

const MAX_RECEIVING_VERSION = 2_147_483_647;

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
  worldTimeMs: number,
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
      const slot = readInboundDockReservation(other);
      return (isActiveInboundTask(other, task.receivingAreaId) && other.unloadingPointId === onlyDock.id)
        || (other.receivingAreaId === task.receivingAreaId && slot?.dockId === onlyDock.id
          && slot.startsAtMs <= worldTimeMs && worldTimeMs < slot.endsAtMs);
    });
  const isSingleDockIncompatible = onlyDock !== undefined && !hasDockAssignment && !hasLegacyReceipts(task)
    && !canUseInboundDock(onlyDock, readCargoRequirements(readTripForDeal(reader, task.dealId)?.transportOrder?.cargo));
  const isWaitingDock = task.yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCK
    || (!hasDockAssignment && (task.dockSchedule !== undefined || docks.length > 1 || isSingleDockOccupied || isSingleDockIncompatible));
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
  const { receivingAreaId, tenantId, warehouseId } = scope;
  const { worldTimeMs } = transaction;
  const tasks = transaction.listBy('warehouseInbound', 'scopeId', warehouseId)
    .filter(record => record.lookupKey === tenantId)
    .map(record => record.id === updatedTask?.id ? updatedTask : readInboundTask(record, runtime.errors))
    .filter(task => task.receivingAreaId === receivingAreaId);
  const dockIds = new Set(docks.map(dock => dock.id));
  const occupied = new Map<string, number | undefined>();
  const reservations = new Map<ReceivingTask, InboundDockSlotValue>();
  const changed = new Set<ReceivingTask>();
  const waiting: InboundDockCandidateValue[] = [];
  for (const task of tasks) {
    const isActive = isActiveInboundTask(task, receivingAreaId);
    const slot = readInboundDockReservation(task);
    if (slot !== undefined && (isActive || slot.endsAtMs > worldTimeMs - INBOUND_DOCK_SLOT_GRACE_MS)) {
      reservations.set(task, slot);
    }
    if (!isActive) {
      continue;
    }
    const { unloadingPointId } = task;
    if (unloadingPointId !== undefined && dockIds.has(unloadingPointId)) {
      const endsAtMs = slot?.dockId === unloadingPointId && slot.endsAtMs > worldTimeMs ? slot.endsAtMs : undefined;
      occupied.set(unloadingPointId, occupied.has(unloadingPointId) ? undefined : endsAtMs);
      continue;
    }
    if (task.version >= MAX_RECEIVING_VERSION) {
      continue;
    }
    const gate = readInboundYardGate(transaction, task, tenantId);
    if (isInboundYardBlocked(gate)) {
      if (task.dockSchedule !== undefined && (task.yardAdmissionStatus !== gate || task.dockSchedule.reservation !== undefined)) {
        task.yardAdmissionStatus = gate;
        task.dockSchedule.reservation = undefined;
        reservations.delete(task);
        changed.add(task);
      }
      continue;
    }
    const deal = transaction.get('deals', task.dealId);
    const trip = readTripForDeal(transaction, task.dealId);
    const order = trip?.transportOrder;
    const arrived = trip?.arrivedAt ?? deal?.transitions.find(transition => transition.to === DealStatus.ARRIVED)?.at;
    const deliveryEnd = order?.deliveryWindow?.endsAt;
    const documentsReadyAt = trip?.carrierTitle?.submittedAt;
    waiting.push({
      arrivedAt: arrived === undefined ? 0 : timestampMs(arrived),
      deliveryEndsAt: deliveryEnd === undefined ? Number.MAX_SAFE_INTEGER : timestampMs(deliveryEnd),
      documentsReadyAt: documentsReadyAt === undefined ? undefined : timestampMs(documentsReadyAt),
      ...readCargoRequirements(docks.length === 1 && hasLegacyReceipts(task) ? undefined : order?.cargo),
      task,
    });
  }

  for (const dockId of reservedDockIds ?? []) {
    if (!occupied.has(dockId)) {
      occupied.set(dockId, undefined);
    }
  }
  const primary = docks[0];
  const hasSchedules = reservations.size > 0 || waiting.some(({ task }) => task.dockSchedule !== undefined);
  if (primary !== undefined && hasSchedules && usesOutboundDock(transaction, tenantId, warehouseId, runtime.errors)) {
    occupied.set(primary.id, undefined);
  }
  if (docks.length > 0 && updatedTask?.dockSchedule === undefined && updatedTask?.yardAdmissionStatus === YardAdmissionStatus.ADMITTED
    && (updatedTask.unloadingPointId === undefined || !dockIds.has(updatedTask.unloadingPointId))) {
    updatedTask.yardAdmissionStatus = YardAdmissionStatus.WAITING_DOCK;
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
  const legacy = waiting.filter(({ task }) => task.dockSchedule === undefined);
  const continuingReceipt = legacy[0];
  if (primary !== undefined && docks.length === 1 && continuingReceipt !== undefined
    && hasLegacyReceipts(continuingReceipt.task) && !occupied.has(primary.id)) {
    assignInboundDock(continuingReceipt.task, primary.id);
    occupied.set(primary.id, undefined);
    changed.add(continuingReceipt.task);
  }
  assignScheduledInboundDocks(waiting.filter(({ task }) => task.dockSchedule !== undefined), docks, reservations, occupied,
    worldTimeMs, changed);

  const reservedNow = new Set([...reservations.values()].filter(slot =>
    slot.startsAtMs <= worldTimeMs && worldTimeMs < slot.endsAtMs).map(slot => slot.dockId));
  const available = docks.filter(dock => !occupied.has(dock.id) && !reservedNow.has(dock.id));
  for (const [dockId, { task }] of matchInboundDockQueue(available, legacy)) {
    assignInboundDock(task, dockId);
    changed.add(task);
  }
  for (const task of changed) {
    if (task !== updatedTask) {
      task.version += 1;
      saveInboundTask(transaction, runtime, task, tenantId);
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
  const trip = readTripForDeal(transaction, task.dealId);
  const preferredStartsAt = trip?.assignment?.arrivalAt;
  if (transaction.get('deals', task.dealId)?.deliveryMethod === DeliveryMethod.EXCHANGE && trip?.arrivedAt !== undefined
    && preferredStartsAt !== undefined) {
    task.dockSchedule = create(ReceivingDockScheduleSchema, { preferredStartsAt });
  }
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

  if (task.dockSchedule !== undefined) {
    assignAvailableInboundDocks(transaction, runtime, { ...task, tenantId: record.lookupKey });
    return;
  }
  const status = readInboundYardGate(transaction, task, record.lookupKey);
  if (status === task.yardAdmissionStatus) {
    return;
  }
  if (task.version >= MAX_RECEIVING_VERSION) {
    throw runtime.errors.unavailable();
  }

  task.version += 1;
  task.yardAdmissionStatus = status;
  assignAvailableInboundDocks(transaction, runtime, { ...task, tenantId: record.lookupKey }, task);
  saveInboundTask(transaction, runtime, task, record.lookupKey);
};

export const refreshInboundDockSchedules = async (runtime: IModuleRuntime): Promise<void> => {
  const scheduledAreas = new Set<string>();
  const waitingAreas = new Map<string, InboundDockScopeValue>();
  for (const record of runtime.read.list('warehouseInbound')) {
    const task = readInboundTask(record, runtime.errors);
    const { receivingAreaId, warehouseId } = task;
    const tenantId = record.lookupKey;
    const key = `${tenantId}:${warehouseId}:${receivingAreaId}`;
    if (task.dockSchedule !== undefined) {
      scheduledAreas.add(key);
    }
    if (isActiveInboundTask(task, receivingAreaId) && task.unloadingPointId === undefined) {
      waitingAreas.set(key, { receivingAreaId, tenantId, warehouseId });
    }
  }
  const scopes = [...waitingAreas].filter(([key]) => scheduledAreas.has(key));
  if (scopes.length > 0) {
    await runtime.command((transaction) => {
      for (const [, scope] of scopes) {
        assignAvailableInboundDocks(transaction, runtime, scope);
      }
    });
  }
};

export const hasInboundProduct = (reader: IStateReader, errors: IDomainErrors, tenantId: string, productId: string): boolean =>
  reader.listBy('warehouses', 'tenantId', tenantId).some(warehouse =>
    reader.listBy('warehouseInbound', 'scopeId', warehouse.id).some(record =>
      record.lookupKey === tenantId && readInboundTask(record, errors).orderLines.some(line => line.productId === productId)));
