import type { CalendarDateValue } from '../../calendar/index';

import { compareCalendarDates } from '../../calendar/index';
import { compareIds } from '../../state/index';

const MINUTE_MS = 60_000;
const DELIVERY_WINDOW_MINUTES = 120;
const WAITING_WINDOW_MINUTES = 60;
const URGENT_EXPIRY_DAYS = 2;
const MAX_FACTOR = 100;

export interface YardQueueWeightsValue {
  cargoUrgencyWeight: number;
  deliveryWindowWeight: number;
  explicitUrgencyWeight: number;
  resourceAvailabilityWeight: number;
  waitingTimeWeight: number;
}

export const DEFAULT_YARD_QUEUE_WEIGHTS: Readonly<YardQueueWeightsValue> = {
  cargoUrgencyWeight: 55,
  deliveryWindowWeight: 25,
  explicitUrgencyWeight: 100,
  resourceAvailabilityWeight: 5,
  waitingTimeWeight: 10,
};

export interface YardQueueCandidateValue {
  arrivedAtMs: number | undefined;
  deliveryEndsAtMs: number | undefined;
  earliestUsableExpiry: CalendarDateValue | undefined;
  hasAvailableResources: boolean | undefined;
  hasColdCargo: boolean;
  hasReceipt: boolean;
  id: string;
  isUrgent: boolean;
  manualPrioritySequence?: number | undefined;
}

export type YardQueueReasonCode
  = | 'AVAILABLE_RESOURCES'
    | 'COLD_CARGO'
    | 'DELIVERY_WINDOW'
    | 'EXPIRING_CARGO'
    | 'EXPLICIT_URGENCY'
    | 'MANUAL_PROMOTION'
    | 'STARTED_RECEIPT'
    | 'WAITING_TIME';

export interface YardQueueScoreValue {
  factors: {
    cargoUrgency: number;
    deliveryWindow: number;
    explicitUrgency: number;
    resourceAvailability: number;
    waitingTime: number;
  };
  reasonCodes: readonly YardQueueReasonCode[];
  score: number;
}

const scoreMinutes = (minutes: number, window: number): number =>
  Math.floor(Math.min(window, Math.max(0, minutes)) * MAX_FACTOR / window);

export const scoreYardQueueCandidate = (
  candidate: YardQueueCandidateValue,
  weights: YardQueueWeightsValue,
  nowMs: number,
  warehouseDate: CalendarDateValue,
  hasComparableResources: boolean,
): YardQueueScoreValue => {
  const { arrivedAtMs, deliveryEndsAtMs, earliestUsableExpiry, hasAvailableResources, hasColdCargo, hasReceipt, isUrgent } = candidate;
  const daysUntilExpiry = earliestUsableExpiry === undefined ? undefined : compareCalendarDates(earliestUsableExpiry, warehouseDate);
  const hasExpiringCargo = daysUntilExpiry !== undefined && daysUntilExpiry >= 0 && daysUntilExpiry <= URGENT_EXPIRY_DAYS;
  const factors = {
    cargoUrgency: hasColdCargo || hasExpiringCargo ? MAX_FACTOR : 0,
    deliveryWindow: deliveryEndsAtMs === undefined
      ? 0
      : scoreMinutes(
          DELIVERY_WINDOW_MINUTES - Math.ceil((deliveryEndsAtMs - nowMs) / MINUTE_MS), DELIVERY_WINDOW_MINUTES,
        ),
    explicitUrgency: isUrgent ? MAX_FACTOR : 0,
    resourceAvailability: hasComparableResources && hasAvailableResources === true ? MAX_FACTOR : 0,
    waitingTime: arrivedAtMs === undefined ? 0 : scoreMinutes(Math.floor((nowMs - arrivedAtMs) / MINUTE_MS), WAITING_WINDOW_MINUTES),
  };
  const contributions = {
    cargoUrgency: factors.cargoUrgency * weights.cargoUrgencyWeight,
    deliveryWindow: factors.deliveryWindow * weights.deliveryWindowWeight,
    explicitUrgency: factors.explicitUrgency * weights.explicitUrgencyWeight,
    resourceAvailability: factors.resourceAvailability * weights.resourceAvailabilityWeight,
    waitingTime: factors.waitingTime * weights.waitingTimeWeight,
  };
  const reasons: readonly (readonly [YardQueueReasonCode, boolean])[] = [
    ['STARTED_RECEIPT', hasReceipt],
    ['MANUAL_PROMOTION', candidate.manualPrioritySequence !== undefined],
    ['EXPLICIT_URGENCY', contributions.explicitUrgency > 0],
    ['COLD_CARGO', hasColdCargo && contributions.cargoUrgency > 0],
    ['EXPIRING_CARGO', hasExpiringCargo && contributions.cargoUrgency > 0],
    ['DELIVERY_WINDOW', contributions.deliveryWindow > 0],
    ['WAITING_TIME', contributions.waitingTime > 0],
    ['AVAILABLE_RESOURCES', contributions.resourceAvailability > 0],
  ];

  return {
    factors,
    reasonCodes: reasons.filter(([, applies]) => applies).map(([reason]) => reason),
    score: contributions.explicitUrgency + contributions.cargoUrgency + contributions.deliveryWindow
      + contributions.waitingTime + contributions.resourceAvailability,
  };
};

const compareOptionalTimes = (current: number | undefined, prev: number | undefined): number => {
  if (current === prev) {
    return 0;
  }
  if (current === undefined) {
    return 1;
  }
  if (prev === undefined) {
    return -1;
  }
  return current - prev;
};

export const hasComparableYardResources = (candidates: readonly YardQueueCandidateValue[]): boolean =>
  candidates.every(candidate => candidate.hasAvailableResources !== undefined);

export const rankYardQueue = <T extends YardQueueCandidateValue>(
  candidates: readonly T[],
  weights: YardQueueWeightsValue,
  nowMs: number,
  warehouseDate: CalendarDateValue,
  hasComparableResources = hasComparableYardResources(candidates),
): T[] => {
  const scored = candidates.map(candidate => ({
    candidate,
    score: scoreYardQueueCandidate(candidate, weights, nowMs, warehouseDate, hasComparableResources).score,
  }));

  scored.sort(({ candidate: current, score }, { candidate: prev, score: prevScore }) =>
    Number(prev.hasReceipt) - Number(current.hasReceipt)
    || compareOptionalTimes(current.manualPrioritySequence, prev.manualPrioritySequence)
    || prevScore - score
    || (weights.deliveryWindowWeight > 0 ? compareOptionalTimes(current.deliveryEndsAtMs, prev.deliveryEndsAtMs) : 0)
    || compareOptionalTimes(current.arrivedAtMs, prev.arrivedAtMs)
    || compareIds(current.id, prev.id));
  return scored.map(({ candidate }) => candidate);
};
