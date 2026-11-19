import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import {
  DockSlotRescheduleReason,
  DockSlotReservationSchema,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';

import type {
  InboundCargoRequirementsValue,
  InboundDockValue,
} from './inboundDockQueue';
import type { InboundDockSlotValue } from './inboundDockSlots';
import type { YardQueueCandidateValue } from './yardQueueScoring';

import { canUseInboundDock } from './inboundDockQueue';
import {
  findInboundDockSlot,
  INBOUND_DOCK_SLOT_GRACE_MS,
  isInboundDockSlotExpired,
} from './inboundDockSlots';

export interface InboundDockAllocationValue {
  changed: Set<ReceivingTask>;
  occupied: Map<string, number | undefined>;
  reservations: Map<ReceivingTask, InboundDockSlotValue>;
  worldTimeMs: number;
}

export interface InboundDockCandidateValue extends InboundCargoRequirementsValue, YardQueueCandidateValue {
  documentsReadyAt: number | undefined;
  task: ReceivingTask;
}

export const readInboundDockReservation = (task: ReceivingTask): InboundDockSlotValue | undefined => {
  const reservation = task.dockSchedule?.reservation;
  if (reservation?.startsAt === undefined || reservation.endsAt === undefined || reservation.unloadingPointId === '') {
    return undefined;
  }
  return {
    dockId: reservation.unloadingPointId,
    endsAtMs: timestampMs(reservation.endsAt),
    startsAtMs: timestampMs(reservation.startsAt),
  };
};

export const assignInboundDock = (task: ReceivingTask, dockId: string): void => {
  task.unloadingPointId = dockId;
  if (task.yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCK) {
    task.yardAdmissionStatus = YardAdmissionStatus.ADMITTED;
  }
};

export const clearUnavailableInboundReservations = (
  candidates: readonly InboundDockCandidateValue[],
  docks: readonly InboundDockValue[],
  { changed, occupied, reservations, worldTimeMs }: InboundDockAllocationValue,
): void => {
  for (const candidate of candidates) {
    const { task } = candidate;
    const schedule = task.dockSchedule;
    const slot = reservations.get(task);
    if (schedule === undefined || slot === undefined) {
      continue;
    }

    const hasCompatibleDock = docks.some(dock => dock.id === slot.dockId && canUseInboundDock(dock, candidate));
    const hasExpired = isInboundDockSlotExpired(slot, worldTimeMs);
    if (!hasCompatibleDock || hasExpired) {
      reservations.delete(task);
      schedule.reservation = undefined;
      const expiredReason = occupied.has(slot.dockId) ? DockSlotRescheduleReason.DOCK_BUSY : DockSlotRescheduleReason.SLOT_EXPIRED;
      schedule.lastRescheduleReason = hasCompatibleDock ? expiredReason : DockSlotRescheduleReason.DOCK_CHANGED;
      changed.add(task);
    }
  }
};

export const assignScheduledInboundDock = (
  candidate: InboundDockCandidateValue,
  docks: readonly InboundDockValue[],
  { changed, occupied, reservations, worldTimeMs }: InboundDockAllocationValue,
): void => {
  const { arrivedAtMs, documentsReadyAt, task } = candidate;
  const schedule = task.dockSchedule;
  if (schedule?.preferredStartsAt === undefined) {
    return;
  }

  const wasWaitingForDocuments = task.yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCUMENTS;
  if (task.yardAdmissionStatus !== YardAdmissionStatus.WAITING_DOCK) {
    task.yardAdmissionStatus = YardAdmissionStatus.WAITING_DOCK;
    changed.add(task);
  }

  const current = reservations.get(task);
  if (current !== undefined && worldTimeMs < current.startsAtMs) {
    return;
  }

  const others = [...reservations].filter(([owner]) => owner !== task).map(([, slot]) => slot);
  const available = docks.map(dock => ({
    ...dock,
    availableFromMs: occupied.has(dock.id) ? occupied.get(dock.id) : Number.NEGATIVE_INFINITY,
  }));
  let next = current;
  let reason = schedule.lastRescheduleReason;
  if (current !== undefined) {
    if (occupied.has(current.dockId)) {
      const alternative = findInboundDockSlot(available.filter(dock => !occupied.has(dock.id)), candidate, others, current.startsAtMs);
      if (alternative?.startsAtMs === current.startsAtMs) {
        next = alternative;
        reason = DockSlotRescheduleReason.DOCK_BUSY;
      }
    }
  }
  else {
    const preferred = Math.ceil(timestampMs(schedule.preferredStartsAt));
    const deadline = preferred + INBOUND_DOCK_SLOT_GRACE_MS;
    let earliest = Math.max(worldTimeMs, preferred);
    if (reason === DockSlotRescheduleReason.UNSPECIFIED) {
      if (worldTimeMs <= deadline) {
        earliest = preferred;
      }
      else if (arrivedAtMs !== undefined && arrivedAtMs > deadline) {
        reason = DockSlotRescheduleReason.LATE_ARRIVAL;
      }
      else if (wasWaitingForDocuments || (documentsReadyAt !== undefined && documentsReadyAt > deadline)) {
        reason = DockSlotRescheduleReason.LATE_DOCUMENTS;
      }
      else {
        reason = DockSlotRescheduleReason.SLOT_EXPIRED;
      }
    }
    next = findInboundDockSlot(available, candidate, others, earliest);
    if (reason === DockSlotRescheduleReason.UNSPECIFIED && next?.startsAtMs !== preferred) {
      reason = DockSlotRescheduleReason.SLOT_UNAVAILABLE;
    }
  }

  if (next !== current || (next === undefined && schedule.reservation !== undefined) || reason !== schedule.lastRescheduleReason) {
    schedule.lastRescheduleReason = reason;
    if (next === undefined) {
      reservations.delete(task);
      schedule.reservation = undefined;
    }
    else {
      reservations.set(task, next);
      schedule.reservation = create(DockSlotReservationSchema, {
        endsAt: timestampFromMs(next.endsAtMs),
        startsAt: timestampFromMs(next.startsAtMs),
        unloadingPointId: next.dockId,
      });
    }
    changed.add(task);
  }
  if (next !== undefined && next.startsAtMs <= worldTimeMs && !occupied.has(next.dockId)) {
    assignInboundDock(task, next.dockId);
    occupied.set(next.dockId, next.endsAtMs);
    changed.add(task);
  }
};
