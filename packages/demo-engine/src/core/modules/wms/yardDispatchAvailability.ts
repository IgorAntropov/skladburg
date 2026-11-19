import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  YardAdmissionStatus,
  YardDispatchBlockedReason,
} from '@skladburg/contracts/wms/v1/receiving';

import type { InboundDockValue } from './inboundDockQueue';
import type { InboundDockCandidateValue } from './inboundDockSchedule';
import type { InboundDockSlotValue } from './inboundDockSlots';

import { canUseInboundDock } from './inboundDockQueue';
import { findInboundDockSlot } from './inboundDockSlots';
import { isReceivingTaskActive } from './inboundRecords';

interface YardDockAssignmentInputValue {
  candidate: InboundDockCandidateValue;
  docks: readonly InboundDockValue[];
  occupiedDockIds: ReadonlySet<string>;
  reservations: ReadonlyMap<ReceivingTask, InboundDockSlotValue>;
  worldTimeMs: number;
}

type YardDockAssignmentValue
  = | { kind: 'available'; slot: InboundDockSlotValue | undefined }
    | { kind: 'blocked'; reason: YardDispatchBlockedReason };

export const readYardDispatchVisitBlock = (task: ReceivingTask, gate: YardAdmissionStatus): undefined | YardDispatchBlockedReason => {
  if (task.unloadingPointId !== undefined || task.receivedUnits.length > 0) {
    return YardDispatchBlockedReason.ALREADY_ASSIGNED;
  }
  if (!isReceivingTaskActive(task)) {
    return YardDispatchBlockedReason.VISIT_NOT_WAITING;
  }
  switch (gate) {
    case YardAdmissionStatus.ADMITTED:
      return undefined;
    case YardAdmissionStatus.PASS_REJECTED:
      return YardDispatchBlockedReason.PASS_REJECTED;
    case YardAdmissionStatus.WAITING_DOCUMENTS:
      return YardDispatchBlockedReason.WAITING_DOCUMENTS;
    default:
      return YardDispatchBlockedReason.VISIT_NOT_WAITING;
  }
};

export const readYardPromotionBlock = (
  candidate: InboundDockCandidateValue,
  docks: readonly InboundDockValue[],
  slot: InboundDockSlotValue | undefined,
): undefined | YardDispatchBlockedReason => {
  if (candidate.manualPrioritySequence !== undefined) {
    return YardDispatchBlockedReason.ALREADY_PROMOTED;
  }
  if (slot !== undefined) {
    return YardDispatchBlockedReason.RESERVATION_PROTECTED;
  }
  return docks.some(dock => canUseInboundDock(dock, candidate)) ? undefined : YardDispatchBlockedReason.INCOMPATIBLE_DOCK;
};

export const readYardDockAssignment = ({
  candidate, docks, occupiedDockIds, reservations, worldTimeMs,
}: YardDockAssignmentInputValue, unloadingPointId: string): YardDockAssignmentValue => {
  const dock = docks.find(point => point.id === unloadingPointId);
  if (dock === undefined) {
    return { kind: 'blocked', reason: YardDispatchBlockedReason.DOCK_NOT_FOUND };
  }
  if (!canUseInboundDock(dock, candidate)) {
    return { kind: 'blocked', reason: YardDispatchBlockedReason.INCOMPATIBLE_DOCK };
  }
  const { task } = candidate;
  const current = reservations.get(task);
  const preferred = task.dockSchedule?.preferredStartsAt;
  if (current !== undefined && current.dockId !== unloadingPointId) {
    return { kind: 'blocked', reason: YardDispatchBlockedReason.RESERVATION_PROTECTED };
  }
  const startsAt = current?.startsAtMs ?? (preferred === undefined ? worldTimeMs : Math.ceil(timestampMs(preferred)));
  if (worldTimeMs < startsAt) {
    return { kind: 'blocked', reason: YardDispatchBlockedReason.SLOT_NOT_STARTED };
  }
  if (occupiedDockIds.has(unloadingPointId)) {
    return { kind: 'blocked', reason: YardDispatchBlockedReason.DOCK_BUSY };
  }
  const otherSlots = [...reservations].filter(([owner]) => owner !== task).map(([, slot]) => slot);
  if (current === undefined) {
    const slot = findInboundDockSlot([{ ...dock, availableFromMs: worldTimeMs }], candidate, otherSlots, worldTimeMs);
    return slot?.startsAtMs === worldTimeMs
      ? { kind: 'available', slot }
      : { kind: 'blocked', reason: YardDispatchBlockedReason.RESERVATION_PROTECTED };
  }
  const hasOverlap = otherSlots.some(slot =>
    slot.dockId === unloadingPointId && slot.startsAtMs < current.endsAtMs && worldTimeMs < slot.endsAtMs);
  return hasOverlap
    ? { kind: 'blocked', reason: YardDispatchBlockedReason.RESERVATION_PROTECTED }
    : { kind: 'available', slot: undefined };
};
