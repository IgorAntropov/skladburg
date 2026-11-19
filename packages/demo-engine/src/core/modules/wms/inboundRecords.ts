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

import type { CalendarDateValue } from '../../calendar/index';
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
import type { YardQueueWeightsValue } from './yardQueueScoring';

import {
  compareCalendarDates,
  isCalendarDateExisting,
  toCalendarDate,
} from '../../calendar/index';
import { readTripForDeal } from '../logistics/tripRecords';
import { canUseInboundDock } from './inboundDockQueue';
import {
  assignInboundDock,
  readInboundDockReservation,
} from './inboundDockSchedule';
import {
  INBOUND_DOCK_SLOT_GRACE_MS,
  isInboundDockSlotExpired,
} from './inboundDockSlots';
import { allocateInboundQueue } from './inboundQueueAllocation';
import {
  isInboundYardBlocked,
  readInboundYardGate,
} from './inboundYardGate';
import { usesOutboundDock } from './outboundDockOccupancy';
import {
  readEffectiveWarehouseDocks,
  readOwnedWarehouseTopology,
} from './warehouseTopologyRecords';
import {
  DEFAULT_YARD_QUEUE_WEIGHTS,
  rankYardQueue,
} from './yardQueueScoring';

export const MAX_RECEIVING_VERSION = 2_147_483_647;

interface InboundDockScopeValue {
  receivingAreaId: string;
  tenantId: string;
  warehouseId: string;
}

interface InboundScheduleWindowValue {
  current: number;
  previous: number;
}

const readCargoRequirements = (cargo: TransportCargo | undefined): InboundCargoRequirementsValue => ({
  hasColdCargo: cargo?.cargoKind === VehicleCargoKind.TEMPERATURE_CONTROLLED || cargo?.temperature !== undefined,
  hasOversizeCargo: cargo?.cargoKind === VehicleCargoKind.OVERSIZE,
});

export const readInboundDocks = (
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

export const isReceivingTaskActive = (task: ReceivingTask): boolean =>
  task.status === ReceivingTaskStatus.OPEN || task.status === ReceivingTaskStatus.IN_PROGRESS;

const isActiveInboundTask = (task: ReceivingTask, receivingAreaId: string): boolean =>
  task.receivingAreaId === receivingAreaId && isReceivingTaskActive(task);

const hasLegacyReceipts = (task: ReceivingTask): boolean =>
  task.yardAdmissionStatus === YardAdmissionStatus.UNSPECIFIED && task.receivedUnits.length > 0;

const readEarliestUsableExpiry = (task: ReceivingTask, today: CalendarDateValue): CalendarDateValue | undefined => {
  let earliest: CalendarDateValue | undefined;
  for (const unit of task.expectedUnits) {
    for (const { expiresOn } of unit.batches) {
      if (expiresOn !== undefined && isCalendarDateExisting(expiresOn) && compareCalendarDates(expiresOn, today) >= 0
        && (earliest === undefined || compareCalendarDates(expiresOn, earliest) < 0)) {
        earliest = expiresOn;
      }
    }
  }
  return earliest;
};

export const readYardQueueWeights = (reader: IStateReader, tenantId: string): YardQueueWeightsValue => {
  const stored = reader.get('yardQueuePolicies', tenantId)?.weights;
  const defaults = DEFAULT_YARD_QUEUE_WEIGHTS;
  return {
    cargoUrgencyWeight: stored?.cargoUrgencyWeight ?? defaults.cargoUrgencyWeight,
    deliveryWindowWeight: stored?.deliveryWindowWeight ?? defaults.deliveryWindowWeight,
    explicitUrgencyWeight: stored?.explicitUrgencyWeight ?? defaults.explicitUrgencyWeight,
    resourceAvailabilityWeight: stored?.resourceAvailabilityWeight ?? defaults.resourceAvailabilityWeight,
    waitingTimeWeight: stored?.waitingTimeWeight ?? defaults.waitingTimeWeight,
  };
};

export const readInboundDockCandidate = (
  reader: IStateReader,
  task: ReceivingTask,
  tenantId: string,
  dockCount: number,
  warehouseDate: CalendarDateValue,
): InboundDockCandidateValue => {
  const deal = reader.get('deals', task.dealId);
  const trip = readTripForDeal(reader, task.dealId);
  const order = trip?.transportOrder;
  const arrived = trip?.arrivedAt ?? deal?.transitions.find(transition => transition.to === DealStatus.ARRIVED)?.at;
  const deliveryEnd = order?.deliveryWindow?.endsAt;
  const documentsReadyAt = trip?.carrierTitle?.submittedAt;
  return {
    arrivedAtMs: arrived === undefined ? undefined : timestampMs(arrived),
    deliveryEndsAtMs: deliveryEnd === undefined ? undefined : timestampMs(deliveryEnd),
    documentsReadyAt: documentsReadyAt === undefined ? undefined : timestampMs(documentsReadyAt),
    earliestUsableExpiry: readEarliestUsableExpiry(task, warehouseDate),
    ...readCargoRequirements(dockCount === 1 && hasLegacyReceipts(task) ? undefined : order?.cargo),
    hasAvailableResources: undefined,
    hasReceipt: task.receivedUnits.length > 0,
    id: task.id,
    isUrgent: deal?.customerOrganizationId === tenantId && deal.isUrgent === true,
    manualPrioritySequence: reader.get('warehouseInbound', task.id)?.manualPrioritySequence,
    task,
  };
};

export const readInboundDockUsage = (
  tasks: readonly ReceivingTask[],
  docks: readonly InboundDockValue[],
  receivingAreaId: string,
  worldTimeMs: number,
): { occupied: Map<string, number | undefined>; reservations: Map<ReceivingTask, InboundDockSlotValue> } => {
  const dockIds = new Set(docks.map(dock => dock.id));
  const occupied = new Map<string, number | undefined>();
  const reservations = new Map<ReceivingTask, InboundDockSlotValue>();
  for (const task of tasks) {
    const isActive = isActiveInboundTask(task, receivingAreaId);
    const slot = readInboundDockReservation(task);
    if (slot !== undefined && (isActive || slot.endsAtMs > worldTimeMs - INBOUND_DOCK_SLOT_GRACE_MS)) {
      reservations.set(task, slot);
    }
    const { unloadingPointId } = task;
    if (isActive && unloadingPointId !== undefined && dockIds.has(unloadingPointId)) {
      const endsAtMs = slot?.dockId === unloadingPointId && slot.endsAtMs > worldTimeMs ? slot.endsAtMs : undefined;
      occupied.set(unloadingPointId, occupied.has(unloadingPointId) ? undefined : endsAtMs);
    }
  }
  return { occupied, reservations };
};

export const discardUnavailableInboundReservations = (
  read: IStateReader,
  tenantId: string,
  docks: readonly InboundDockValue[],
  reservations: Map<ReceivingTask, InboundDockSlotValue>,
  worldTimeMs: number,
  warehouseDate: CalendarDateValue,
): void => {
  for (const [owner, slot] of reservations) {
    if (!isReceivingTaskActive(owner) || owner.version >= MAX_RECEIVING_VERSION || docks.some(dock => dock.id === owner.unloadingPointId)) {
      continue;
    }
    const candidate = readInboundDockCandidate(read, owner, tenantId, docks.length, warehouseDate);
    if (isInboundDockSlotExpired(slot, worldTimeMs) || isInboundYardBlocked(readInboundYardGate(read, owner, tenantId))
      || !docks.some(dock => dock.id === slot.dockId && canUseInboundDock(dock, candidate))) {
      reservations.delete(owner);
    }
  }
};

export const readInboundWarehouseDate = (reader: IStateReader, warehouseId: string, worldTimeMs: number): CalendarDateValue => {
  const timeZone = reader.get('warehouses', warehouseId)?.timeZone ?? '';
  return toCalendarDate(worldTimeMs, timeZone === '' ? 'UTC' : timeZone);
};

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

const publishReceivingTasksChanged = (
  transaction: IStateTransaction,
  { outbox }: Pick<IModuleRuntime, 'outbox'>,
  warehouseId: string,
): void => {
  outbox.add(transaction, tasksChannel(warehouseId), {
    case: 'receivingTasksChanged',
    value: create(ReceivingTasksChangedSchema, { warehouseId }),
  });
};

export const saveInboundTask = (
  transaction: IStateTransaction,
  runtime: Pick<IModuleRuntime, 'outbox'>,
  task: ReceivingTask,
  tenantId: string,
): void => {
  const hasUnspentPromotion = isReceivingTaskActive(task) && task.unloadingPointId === undefined && task.receivedUnits.length === 0
    && task.dockSchedule?.reservation === undefined && !isInboundYardBlocked(task.yardAdmissionStatus);
  const manualPrioritySequence = hasUnspentPromotion ? transaction.get('warehouseInbound', task.id)?.manualPrioritySequence : undefined;
  transaction.put('warehouseInbound', {
    bytes: toBinary(ReceivingTaskSchema, task),
    id: task.id,
    lookupKey: tenantId,
    manualPrioritySequence,
    scopeId: task.warehouseId,
  });

  if (task.version > 0) {
    publishReceivingTasksChanged(transaction, runtime, task.warehouseId);
  }
};

export const assignAvailableInboundDocks = (
  transaction: IStateTransaction,
  runtime: Pick<IModuleRuntime, 'errors' | 'outbox'>,
  scope: InboundDockScopeValue,
  updatedTask?: ReceivingTask,
  reservedDockIds?: ReadonlySet<string>,
): boolean => {
  const docks = readInboundDocks(transaction, runtime.errors, scope);
  const { receivingAreaId, tenantId, warehouseId } = scope;
  const { worldTimeMs } = transaction;
  const warehouseDate = readInboundWarehouseDate(transaction, warehouseId, worldTimeMs);
  const tasks = transaction.listBy('warehouseInbound', 'scopeId', warehouseId)
    .filter(record => record.lookupKey === tenantId)
    .map(record => record.id === updatedTask?.id ? updatedTask : readInboundTask(record, runtime.errors))
    .filter(task => task.receivingAreaId === receivingAreaId);
  const dockIds = new Set(docks.map(dock => dock.id));
  const { occupied, reservations } = readInboundDockUsage(tasks, docks, receivingAreaId, worldTimeMs);
  const changed = new Set<ReceivingTask>();
  const waiting: InboundDockCandidateValue[] = [];
  for (const task of tasks) {
    if (!isActiveInboundTask(task, receivingAreaId)) {
      continue;
    }
    const { unloadingPointId } = task;
    if (unloadingPointId !== undefined && dockIds.has(unloadingPointId)) {
      continue;
    }
    if (task.version >= MAX_RECEIVING_VERSION) {
      continue;
    }
    const gate = readInboundYardGate(transaction, task, tenantId);
    if (isInboundYardBlocked(gate)) {
      const hasPromotion = transaction.get('warehouseInbound', task.id)?.manualPrioritySequence !== undefined;
      const needsScheduleUpdate = task.dockSchedule !== undefined
        && (task.yardAdmissionStatus !== gate || task.dockSchedule.reservation !== undefined);
      if (hasPromotion || needsScheduleUpdate) {
        task.yardAdmissionStatus = gate;
        if (task.dockSchedule !== undefined) {
          task.dockSchedule.reservation = undefined;
        }
        reservations.delete(task);
        changed.add(task);
      }
      continue;
    }
    waiting.push(readInboundDockCandidate(transaction, task, tenantId, docks.length, warehouseDate));
  }

  for (const dockId of reservedDockIds ?? []) {
    if (!occupied.has(dockId)) {
      occupied.set(dockId, undefined);
    }
  }
  const primary = docks[0];
  const hasDispatchConstraints = reservations.size > 0
    || waiting.some(candidate => candidate.task.dockSchedule !== undefined || candidate.manualPrioritySequence !== undefined);
  if (primary !== undefined && hasDispatchConstraints && usesOutboundDock(transaction, tenantId, warehouseId, runtime.errors)) {
    occupied.set(primary.id, undefined);
  }
  if (docks.length > 0 && updatedTask?.dockSchedule === undefined && updatedTask?.yardAdmissionStatus === YardAdmissionStatus.ADMITTED
    && (updatedTask.unloadingPointId === undefined || !dockIds.has(updatedTask.unloadingPointId))) {
    updatedTask.yardAdmissionStatus = YardAdmissionStatus.WAITING_DOCK;
  }

  const canBook = (candidate: InboundDockCandidateValue): boolean => docks.some(dock => canUseInboundDock(dock, candidate));
  const sorted = rankYardQueue(waiting.filter(canBook), readYardQueueWeights(transaction, tenantId), worldTimeMs, warehouseDate);
  const continuingReceipt = sorted.find(({ task }) => task.dockSchedule === undefined);
  if (primary !== undefined && docks.length === 1 && continuingReceipt !== undefined
    && hasLegacyReceipts(continuingReceipt.task) && !occupied.has(primary.id)) {
    assignInboundDock(continuingReceipt.task, primary.id);
    occupied.set(primary.id, undefined);
    changed.add(continuingReceipt.task);
  }
  const queue = sorted.filter(({ task }) => task.unloadingPointId === undefined || !dockIds.has(task.unloadingPointId));
  queue.push(...waiting.filter(candidate => candidate.task.dockSchedule !== undefined && !canBook(candidate)));
  allocateInboundQueue(queue, docks, { changed, occupied, reservations, worldTimeMs });
  for (const task of changed) {
    if (task !== updatedTask) {
      task.version += 1;
      saveInboundTask(transaction, runtime, task, tenantId);
    }
  }
  return changed.size > 0;
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

export const refreshInboundDockSchedules = async (
  runtime: IModuleRuntime,
  time?: InboundScheduleWindowValue,
): Promise<void> => {
  const monitoredAreas = new Set<string>();
  const newlyStartedAreas = new Set<string>();
  const waitingAreas = new Map<string, InboundDockScopeValue>();
  for (const record of runtime.read.list('warehouseInbound')) {
    const task = readInboundTask(record, runtime.errors);
    const { receivingAreaId, warehouseId } = task;
    const tenantId = record.lookupKey;
    const key = `${tenantId}:${warehouseId}:${receivingAreaId}`;
    if (task.dockSchedule !== undefined || record.manualPrioritySequence !== undefined) {
      monitoredAreas.add(key);
    }
    if (isReceivingTaskActive(task) && task.unloadingPointId === undefined) {
      waitingAreas.set(key, { receivingAreaId, tenantId, warehouseId });
      const slot = readInboundDockReservation(task);
      if (time !== undefined && slot !== undefined && time.previous < slot.startsAtMs && slot.startsAtMs <= time.current) {
        newlyStartedAreas.add(key);
      }
    }
  }
  const scopes = [...waitingAreas].filter(([key]) => monitoredAreas.has(key));
  if (scopes.length > 0) {
    await runtime.command((transaction) => {
      for (const [key, scope] of scopes) {
        const hasChanges = assignAvailableInboundDocks(transaction, runtime, scope);
        if (!hasChanges && newlyStartedAreas.has(key)) {
          publishReceivingTasksChanged(transaction, runtime, scope.warehouseId);
        }
      }
    });
  }
};

export const createDockScheduleRefresh = (initialWorldTimeMs: number): (runtime: IModuleRuntime) => Promise<void> => {
  let previous = initialWorldTimeMs;
  return async (runtime) => {
    const current = runtime.getWorldTimeMs();
    await refreshInboundDockSchedules(runtime, { current, previous });
    previous = current;
  };
};

export const hasInboundProduct = (reader: IStateReader, errors: IDomainErrors, tenantId: string, productId: string): boolean =>
  reader.listBy('warehouses', 'tenantId', tenantId).some(warehouse =>
    reader.listBy('warehouseInbound', 'scopeId', warehouse.id).some(record =>
      record.lookupKey === tenantId && readInboundTask(record, errors).orderLines.some(line => line.productId === productId)));
