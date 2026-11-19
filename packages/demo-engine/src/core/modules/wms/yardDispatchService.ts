import type {
  DescMessage,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';
import type { ServiceImpl } from '@connectrpc/connect';
import type {
  DockSlotReservation,
  PromoteYardVisitRequest,
  ReceivingTask,
  YardDispatchEntry,
  YardDispatchState,
} from '@skladburg/contracts/wms/v1/receiving';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  YardDispatchBlockedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  AssignYardVisitToDockResponseSchema,
  DockSlotReservationSchema,
  ListYardDispatchEntriesResponseSchema,
  PromoteYardVisitResponseSchema,
  WarehouseReceivingService,
  YardAdmissionStatus,
  YardDispatchAction,
  YardDispatchBlockedReason,
  YardDispatchEntrySchema,
  YardDispatchOutcome,
  YardDispatchStateSchema,
} from '@skladburg/contracts/wms/v1/receiving';

import type { IDomainErrors } from '../../errors/index';
import type { IStateTransaction } from '../../state/index';
import type {
  WarehouseInboundRecordValue,
  WarehouseStockRecordValue,
} from '../../state/records';
import type { IModuleRuntime } from '../moduleRuntime';
import type { InboundDockValue } from './inboundDockQueue';
import type { InboundDockCandidateValue } from './inboundDockSchedule';
import type { InboundDockSlotValue } from './inboundDockSlots';

import { paginate } from '../pagination';
import { canUseInboundDock } from './inboundDockQueue';
import { assignInboundDock } from './inboundDockSchedule';
import { findInboundDockSlot } from './inboundDockSlots';
import {
  assignAvailableInboundDocks,
  discardUnavailableInboundReservations,
  isReceivingTaskActive,
  MAX_RECEIVING_VERSION,
  readInboundDockCandidate,
  readInboundDocks,
  readInboundDockUsage,
  readInboundTask,
  readInboundWarehouseDate,
  saveInboundTask,
} from './inboundRecords';
import { readInboundYardGate } from './inboundYardGate';
import { readWarehouseReceivingLayoutOccupancy } from './warehouseReceivingLayoutOccupancy';
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';

interface YardDispatchCommandValue<TInput extends DescMessage, TOutput extends DescMessage> {
  action: YardDispatchAction;
  apply: (context: YardDispatchContextValue) => void;
  headers: Headers;
  method: DescMethodUnary<TInput, TOutput>;
  request: MessageShape<TInput> & YardDispatchRequestValue;
  respond: (confirmation: YardDispatchConfirmationValue) => MessageShape<TOutput>;
}

interface YardDispatchConfirmationValue {
  entryId: string;
  outcome: YardDispatchOutcome;
  reservation: DockSlotReservation | undefined;
  taskId: string;
  taskVersion: number;
  unloadingPointId: string | undefined;
}

interface YardDispatchContextValue {
  candidate: InboundDockCandidateValue;
  docks: readonly InboundDockValue[];
  record: WarehouseInboundRecordValue;
  reservations: ReadonlyMap<ReceivingTask, InboundDockSlotValue>;
  runtime: IModuleRuntime;
  sequence: number;
  task: ReceivingTask;
  topology: WarehouseTopology;
  transaction: IStateTransaction;
}

type YardDispatchMethodsValue = Pick<ServiceImpl<typeof WarehouseReceivingService>,
  'assignYardVisitToDock' | 'listYardDispatchEntries' | 'promoteYardVisit'>;

type YardDispatchRequestValue = Pick<PromoteYardVisitRequest, 'expectedVersion' | 'idempotencyKey' | 'reason' | 'taskId' | 'warehouseId'>;

const refuseYardDispatch = (errors: IDomainErrors, reason: YardDispatchBlockedReason): never => {
  throw errors.create(ErrorCode.YARD_DISPATCH_BLOCKED, {
    case: 'yardDispatchBlocked',
    value: create(YardDispatchBlockedParamsSchema, { reason: YardDispatchBlockedReason[reason] }),
  });
};

const requireWaitingYardVisit = (transaction: IStateTransaction, errors: IDomainErrors, task: ReceivingTask, tenantId: string): void => {
  if (task.unloadingPointId !== undefined || task.receivedUnits.length > 0) {
    refuseYardDispatch(errors, YardDispatchBlockedReason.ALREADY_ASSIGNED);
  }
  if (!isReceivingTaskActive(task)) {
    refuseYardDispatch(errors, YardDispatchBlockedReason.VISIT_NOT_WAITING);
  }
  const gate = readInboundYardGate(transaction, task, tenantId);
  switch (gate) {
    case YardAdmissionStatus.ADMITTED:
      return;
    case YardAdmissionStatus.PASS_REJECTED:
      return refuseYardDispatch(errors, YardDispatchBlockedReason.PASS_REJECTED);
    case YardAdmissionStatus.WAITING_DOCUMENTS:
      return refuseYardDispatch(errors, YardDispatchBlockedReason.WAITING_DOCUMENTS);
    default:
      return refuseYardDispatch(errors, YardDispatchBlockedReason.VISIT_NOT_WAITING);
  }
};

const readDispatchEntry = (record: WarehouseStockRecordValue, errors: IDomainErrors): YardDispatchEntry => {
  const entry = fromBinary(YardDispatchEntrySchema, record.bytes);
  if (entry.id !== record.id || entry.tenantId !== record.lookupKey || entry.warehouseId !== record.scopeId || entry.sequence < 1n) {
    throw errors.internal();
  }
  return entry;
};

const captureYardDispatchState = (task: ReceivingTask, manualPrioritySequence: number | undefined): YardDispatchState =>
  create(YardDispatchStateSchema, {
    isManuallyPrioritized: manualPrioritySequence !== undefined,
    reservation: task.dockSchedule?.reservation,
    taskVersion: task.version,
    unloadingPointId: task.unloadingPointId,
    yardAdmissionStatus: task.yardAdmissionStatus,
  });

const prepareYardDispatch = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  task: ReceivingTask,
  record: WarehouseInboundRecordValue,
): YardDispatchContextValue => {
  const { lookupKey: tenantId } = record;
  const { errors } = runtime;
  const { receivingAreaId, warehouseId } = task;
  const topology = readOwnedWarehouseTopology(transaction, errors, warehouseId, tenantId);
  if (topology?.receivingArea?.id !== receivingAreaId) {
    return refuseYardDispatch(errors, YardDispatchBlockedReason.DOCK_NOT_FOUND);
  }
  const docks = readInboundDocks(transaction, errors, { receivingAreaId, tenantId, warehouseId });
  const { worldTimeMs } = transaction;
  const warehouseDate = readInboundWarehouseDate(transaction, warehouseId, worldTimeMs);
  const candidate = readInboundDockCandidate(transaction, task, tenantId, docks.length, warehouseDate);
  const others = transaction.listBy('warehouseInbound', 'scopeId', warehouseId)
    .filter(other => other.lookupKey === tenantId && other.id !== task.id)
    .map(other => readInboundTask(other, errors))
    .filter(other => other.receivingAreaId === receivingAreaId);
  const { reservations } = readInboundDockUsage([task, ...others], docks, receivingAreaId, worldTimeMs);
  discardUnavailableInboundReservations(transaction, tenantId, docks, reservations, worldTimeMs, warehouseDate);
  const entries = transaction.listBy('yardDispatchEntries', 'scopeId', warehouseId).filter(entry => entry.lookupKey === tenantId);
  const sequence = entries.length + 1;

  return { candidate, docks, record, reservations, runtime, sequence, task, topology, transaction };
};

const promoteYardVisit = ({
  candidate, docks, record, reservations, runtime, sequence, task, transaction,
}: YardDispatchContextValue): void => {
  const { errors } = runtime;
  if (record.manualPrioritySequence !== undefined) {
    refuseYardDispatch(errors, YardDispatchBlockedReason.ALREADY_PROMOTED);
  }
  if (reservations.has(task)) {
    refuseYardDispatch(errors, YardDispatchBlockedReason.RESERVATION_PROTECTED);
  }
  if (!docks.some(dock => canUseInboundDock(dock, candidate))) {
    refuseYardDispatch(errors, YardDispatchBlockedReason.INCOMPATIBLE_DOCK);
  }
  if (task.dockSchedule === undefined) {
    task.yardAdmissionStatus = YardAdmissionStatus.WAITING_DOCK;
  }
  transaction.put('warehouseInbound', { ...record, manualPrioritySequence: sequence });
  assignAvailableInboundDocks(transaction, runtime, { ...task, tenantId: record.lookupKey }, task);
};

const assignYardVisitToDock = (
  { candidate, docks, reservations, runtime, task, topology, transaction }: YardDispatchContextValue,
  unloadingPointId: string,
): void => {
  const { errors } = runtime;
  const dock = docks.find(point => point.id === unloadingPointId);
  if (dock === undefined) {
    return refuseYardDispatch(errors, YardDispatchBlockedReason.DOCK_NOT_FOUND);
  }
  if (!canUseInboundDock(dock, candidate)) {
    refuseYardDispatch(errors, YardDispatchBlockedReason.INCOMPATIBLE_DOCK);
  }
  const { worldTimeMs } = transaction;
  const current = reservations.get(task);
  const preferred = task.dockSchedule?.preferredStartsAt;
  if (current !== undefined && current.dockId !== unloadingPointId) {
    refuseYardDispatch(errors, YardDispatchBlockedReason.RESERVATION_PROTECTED);
  }
  const startsAt = current?.startsAtMs ?? (preferred === undefined ? worldTimeMs : Math.ceil(timestampMs(preferred)));
  if (worldTimeMs < startsAt) {
    refuseYardDispatch(errors, YardDispatchBlockedReason.SLOT_NOT_STARTED);
  }
  if (readWarehouseReceivingLayoutOccupancy(transaction, topology, errors, false).occupiedDockIds.has(unloadingPointId)) {
    refuseYardDispatch(errors, YardDispatchBlockedReason.DOCK_BUSY);
  }
  const otherSlots = [...reservations].filter(([owner]) => owner !== task).map(([, slot]) => slot);
  if (current === undefined) {
    const slot = findInboundDockSlot([{ ...dock, availableFromMs: worldTimeMs }], candidate, otherSlots, worldTimeMs);
    if (slot?.startsAtMs !== worldTimeMs) {
      return refuseYardDispatch(errors, YardDispatchBlockedReason.RESERVATION_PROTECTED);
    }
    if (task.dockSchedule !== undefined) {
      task.dockSchedule.reservation = create(DockSlotReservationSchema, {
        endsAt: timestampFromMs(slot.endsAtMs),
        startsAt: timestampFromMs(slot.startsAtMs),
        unloadingPointId,
      });
    }
  }
  else if (otherSlots.some(slot => slot.dockId === unloadingPointId && slot.startsAtMs < current.endsAtMs && worldTimeMs < slot.endsAtMs)) {
    refuseYardDispatch(errors, YardDispatchBlockedReason.RESERVATION_PROTECTED);
  }
  task.yardAdmissionStatus = YardAdmissionStatus.ADMITTED;
  assignInboundDock(task, unloadingPointId);
};

const runYardDispatchCommand = <TInput extends DescMessage, TOutput extends DescMessage>(
  runtime: IModuleRuntime,
  { action, apply, headers, method, request, respond }: YardDispatchCommandValue<TInput, TOutput>,
): Promise<MessageShape<TOutput>> => runtime.command((transaction) => {
  const { errors, guard, idempotency, random } = runtime;
  const { expectedVersion, idempotencyKey, taskId, warehouseId } = request;
  const caller = guard.guardPermissionCall(transaction, method, request, headers);
  if (caller.admission.kind !== 'membership') {
    throw errors.permissionDenied('yard_manage', warehouseId);
  }
  const { organizationId: tenantId, user } = caller;
  return idempotency.run(transaction, {
    handler: () => {
      const record = transaction.get('warehouseInbound', taskId);
      if (record?.scopeId !== warehouseId || record.lookupKey !== tenantId) {
        throw errors.notFound(EntityKind.RECEIVING_TASK);
      }
      const task = readInboundTask(record, errors);
      if (task.version === 0) {
        throw errors.notFound(EntityKind.RECEIVING_TASK);
      }
      if (task.version !== expectedVersion) {
        throw errors.versionConflict(EntityKind.RECEIVING_TASK, task.version);
      }
      if (task.version >= MAX_RECEIVING_VERSION) {
        throw errors.unavailable();
      }
      const reason = request.reason.trim();
      if (reason === '') {
        throw errors.validationFailed([{ fieldPath: 'reason', ruleId: 'yard_dispatch.reason_required' }]);
      }
      requireWaitingYardVisit(transaction, errors, task, tenantId);
      const context = prepareYardDispatch(transaction, runtime, task, record);
      const before = captureYardDispatchState(task, record.manualPrioritySequence);
      apply(context);
      task.version += 1;
      saveInboundTask(transaction, runtime, task, tenantId);
      const after = captureYardDispatchState(task, transaction.get('warehouseInbound', taskId)?.manualPrioritySequence);
      const outcome = task.unloadingPointId !== undefined
        ? YardDispatchOutcome.DOCK_ASSIGNED
        : after.reservation === undefined ? YardDispatchOutcome.WAITING : YardDispatchOutcome.SLOT_BOOKED;
      const id = random.uuid();
      if (transaction.get('yardDispatchEntries', id) !== undefined) {
        throw errors.internal();
      }
      const entry = create(YardDispatchEntrySchema, {
        action, actorUserId: user.id, after, before, id, occurredAt: timestampFromMs(transaction.worldTimeMs), outcome, reason,
        sequence: BigInt(context.sequence), taskId, tenantId, warehouseId,
      });
      transaction.put('yardDispatchEntries', {
        bytes: toBinary(YardDispatchEntrySchema, entry), id, lookupKey: tenantId, scopeId: warehouseId,
      });
      return respond({
        entryId: id, outcome, reservation: after.reservation, taskId, taskVersion: task.version, unloadingPointId: task.unloadingPointId,
      });
    },
    idempotencyKey,
    method,
    request,
    scope: `${tenantId}:${user.id}`,
  });
});

export const createYardDispatchHandlers = (runtime: IModuleRuntime): YardDispatchMethodsValue => {
  const { errors, guard, read } = runtime;
  const { method } = WarehouseReceivingService;
  return {
    assignYardVisitToDock: (request, context) => runYardDispatchCommand(runtime, {
      action: YardDispatchAction.ASSIGN_DOCK,
      apply: (dispatch) => { assignYardVisitToDock(dispatch, request.unloadingPointId); },
      headers: context.requestHeader,
      method: method.assignYardVisitToDock,
      request,
      respond: result => create(AssignYardVisitToDockResponseSchema, result),
    }),
    listYardDispatchEntries: (request, context) => {
      const { warehouseId } = request;
      const caller = guard.guardPermissionCall(read, method.listYardDispatchEntries, request, context.requestHeader);
      if (caller.admission.kind !== 'membership') {
        throw errors.permissionDenied('yard_view', warehouseId);
      }
      const entries = read.listBy('yardDispatchEntries', 'scopeId', warehouseId)
        .filter(record => record.lookupKey === caller.organizationId)
        .map(record => readDispatchEntry(record, errors))
        .sort((current, prev) => current.sequence < prev.sequence ? 1 : current.sequence > prev.sequence ? -1 : 0);
      const { items, page } = paginate(entries, entry => entry.id, request.page, errors);
      return create(ListYardDispatchEntriesResponseSchema, { entries: items, page });
    },
    promoteYardVisit: (request, context) => runYardDispatchCommand(runtime, {
      action: YardDispatchAction.PROMOTE,
      apply: promoteYardVisit,
      headers: context.requestHeader,
      method: method.promoteYardVisit,
      request,
      respond: result => create(PromoteYardVisitResponseSchema, result),
    }),
  };
};
