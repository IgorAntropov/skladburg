import type { InboundDockValue } from './inboundDockQueue';
import type {
  InboundDockAllocationValue,
  InboundDockCandidateValue,
} from './inboundDockSchedule';

import {
  canUseInboundDock,
  matchInboundDockQueue,
} from './inboundDockQueue';
import {
  assignInboundDock,
  assignScheduledInboundDock,
  clearUnavailableInboundReservations,
} from './inboundDockSchedule';

export const allocateInboundQueue = (
  candidates: readonly InboundDockCandidateValue[],
  docks: readonly InboundDockValue[],
  allocation: InboundDockAllocationValue,
): void => {
  const { changed, occupied, reservations, worldTimeMs } = allocation;
  clearUnavailableInboundReservations(candidates, docks, allocation);
  const unbooked = candidates.filter(({ task }) => !reservations.has(task));
  for (const candidate of candidates) {
    if (reservations.has(candidate.task)) {
      assignScheduledInboundDock(candidate, docks, allocation);
    }
  }

  const accepted: InboundDockCandidateValue[] = [];
  let matches: ReadonlyMap<string, InboundDockCandidateValue> = new Map();
  const getFreeDocks = (): InboundDockValue[] => {
    const reservedNow = new Set([...reservations.values()].filter(slot =>
      slot.startsAtMs <= worldTimeMs && worldTimeMs < slot.endsAtMs).map(slot => slot.dockId));
    return docks.filter(({ id }) => !occupied.has(id) && !reservedNow.has(id));
  };

  for (const candidate of unbooked) {
    const { task } = candidate;
    if (task.dockSchedule === undefined) {
      const next = matchInboundDockQueue(getFreeDocks(), [...accepted, candidate]);
      if (next.size > accepted.length) {
        accepted.push(candidate);
        matches = next;
      }
      continue;
    }

    const unavailable = new Map(occupied);
    const alternateMatches = new Map<string, ReadonlyMap<string, InboundDockCandidateValue>>();
    for (const dock of docks) {
      if (matches.has(dock.id) && canUseInboundDock(dock, candidate)) {
        const alternate = matchInboundDockQueue(getFreeDocks().filter(({ id }) => id !== dock.id), accepted);
        if (alternate.size === accepted.length) {
          alternateMatches.set(dock.id, alternate);
        }
        else {
          unavailable.set(dock.id, undefined);
        }
      }
    }

    assignScheduledInboundDock(candidate, docks, { ...allocation, occupied: unavailable });
    const slot = reservations.get(task);
    if (slot !== undefined) {
      const alternate = alternateMatches.get(slot.dockId);
      if (alternate !== undefined) {
        matches = alternate;
      }
      if (task.unloadingPointId === slot.dockId) {
        occupied.set(slot.dockId, slot.endsAtMs);
      }
    }
  }

  for (const [dockId, { task }] of matches) {
    assignInboundDock(task, dockId);
    occupied.set(dockId, undefined);
    changed.add(task);
  }
};
