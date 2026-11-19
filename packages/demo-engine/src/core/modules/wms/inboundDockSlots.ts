import type {
  InboundCargoRequirementsValue,
  InboundDockValue,
} from './inboundDockQueue';

import { compareIds } from '../../state/index';
import { canUseInboundDock } from './inboundDockQueue';

const MINUTE_MS = 60_000;
export const INBOUND_DOCK_SLOT_DURATION_MS = 30 * MINUTE_MS;
export const INBOUND_DOCK_SLOT_GRACE_MS = 10 * MINUTE_MS;

export interface InboundDockSlotValue {
  dockId: string;
  endsAtMs: number;
  startsAtMs: number;
}

export interface InboundSlotDockValue extends InboundDockValue {
  availableFromMs: number | undefined;
}

const countSpecialties = (dock: InboundDockValue): number => Number(dock.hasColdZone) + Number(dock.canHandleOversize);

export const findInboundDockSlot = (
  docks: readonly InboundSlotDockValue[],
  cargo: InboundCargoRequirementsValue,
  reservations: readonly InboundDockSlotValue[],
  earliestStartMs: number,
): InboundDockSlotValue | undefined => {
  const compatibleDocks = docks.filter(dock => canUseInboundDock(dock, cargo)).sort((current, prev) =>
    countSpecialties(current) - countSpecialties(prev) || compareIds(current.id, prev.id));
  const orderedReservations = reservations.toSorted((current, prev) => current.startsAtMs - prev.startsAtMs);
  let best: InboundDockSlotValue | undefined;

  for (const { availableFromMs, id } of compatibleDocks) {
    if (availableFromMs === undefined) {
      continue;
    }

    let startsAtMs = Math.max(earliestStartMs, availableFromMs);
    for (const reservation of orderedReservations) {
      if (reservation.dockId !== id || reservation.endsAtMs <= startsAtMs) {
        continue;
      }
      if (startsAtMs + INBOUND_DOCK_SLOT_DURATION_MS <= reservation.startsAtMs) {
        break;
      }
      startsAtMs = reservation.endsAtMs;
    }

    if (best === undefined || startsAtMs < best.startsAtMs) {
      best = { dockId: id, endsAtMs: startsAtMs + INBOUND_DOCK_SLOT_DURATION_MS, startsAtMs };
    }
  }

  return best;
};
