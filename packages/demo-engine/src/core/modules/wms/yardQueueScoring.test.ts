import {
  expect,
  it,
} from 'vitest';

import type {
  YardQueueCandidateValue,
  YardQueueWeightsValue,
} from './yardQueueScoring';

import { toCalendarDate } from '../../calendar/index';
import {
  DEFAULT_YARD_QUEUE_WEIGHTS,
  rankYardQueue,
  scoreYardQueueCandidate,
} from './yardQueueScoring';

const MINUTE_MS = 60_000;
const NOW = Date.UTC(2026, 11, 31, 22);
const WAREHOUSE_DATE = toCalendarDate(NOW, 'Europe/Moscow');

const createCandidate = (id: string, facts: Partial<YardQueueCandidateValue> = {}): YardQueueCandidateValue => ({
  arrivedAtMs: undefined,
  deliveryEndsAtMs: undefined,
  earliestUsableExpiry: undefined,
  hasAvailableResources: undefined,
  hasColdCargo: false,
  hasReceipt: false,
  id,
  isUrgent: false,
  ...facts,
});

const zeroWeights: YardQueueWeightsValue = {
  cargoUrgencyWeight: 0,
  deliveryWindowWeight: 0,
  explicitUrgencyWeight: 0,
  resourceAvailabilityWeight: 0,
  waitingTimeWeight: 0,
};

it('ranks the same snapshot differently after policy changes while protecting a started receipt', () => {
  const started = createCandidate('started', { hasReceipt: true });
  const urgent = createCandidate('urgent', { isUrgent: true });
  const cold = createCandidate('cold', { arrivedAtMs: NOW - 60 * MINUTE_MS, deliveryEndsAtMs: NOW, hasColdCargo: true });
  const visits = [cold, started, urgent];

  expect(rankYardQueue(visits, DEFAULT_YARD_QUEUE_WEIGHTS, NOW, WAREHOUSE_DATE)).toEqual([started, urgent, cold]);
  expect(rankYardQueue(visits, { ...DEFAULT_YARD_QUEUE_WEIGHTS, explicitUrgencyWeight: 0 }, NOW, WAREHOUSE_DATE))
    .toEqual([started, cold, urgent]);
  expect(visits).toEqual([cold, started, urgent]);
});

it.each([
  { endsInMs: 120 * MINUTE_MS, factor: 0 },
  { endsInMs: 120 * MINUTE_MS - 1, factor: 0 },
  { endsInMs: 119 * MINUTE_MS, factor: 0 },
  { endsInMs: 60 * MINUTE_MS, factor: 50 },
  { endsInMs: 1, factor: 99 },
  { endsInMs: 0, factor: 100 },
  { endsInMs: -1, factor: 100 },
])('scores a delivery window ending in $endsInMs ms as $factor', ({ endsInMs, factor }) => {
  const visit = createCandidate('visit', { deliveryEndsAtMs: NOW + endsInMs });
  const weights = { ...zeroWeights, deliveryWindowWeight: 25 };
  const { factors, score } = scoreYardQueueCandidate(visit, weights, NOW, WAREHOUSE_DATE, false);

  expect(factors.deliveryWindow).toBe(factor);
  expect(score).toBe(25 * factor);
});

it.each([
  { elapsedMs: -MINUTE_MS, factor: 0 },
  { elapsedMs: MINUTE_MS - 1, factor: 0 },
  { elapsedMs: MINUTE_MS, factor: 1 },
  { elapsedMs: 59 * MINUTE_MS + MINUTE_MS - 1, factor: 98 },
  { elapsedMs: 60 * MINUTE_MS, factor: 100 },
  { elapsedMs: 120 * MINUTE_MS, factor: 100 },
])('scores $elapsedMs ms after arrival as $factor', ({ elapsedMs, factor }) => {
  const visit = createCandidate('visit', { arrivedAtMs: NOW - elapsedMs });
  const weights = { ...zeroWeights, waitingTimeWeight: 10 };
  const { factors, score } = scoreYardQueueCandidate(visit, weights, NOW, WAREHOUSE_DATE, false);

  expect(factors.waitingTime).toBe(factor);
  expect(score).toBe(10 * factor);
});

it('uses local calendar days across the year boundary and omits expired cargo from the factor', () => {
  const expiresLater = createCandidate('soon', { earliestUsableExpiry: { day: 3, month: 1, year: 2027 } });
  const expiresToday = createCandidate('today', { earliestUsableExpiry: WAREHOUSE_DATE });
  const expired = createCandidate('expired', { earliestUsableExpiry: { day: 31, month: 12, year: 2026 } });
  const weights = { ...zeroWeights, cargoUrgencyWeight: 55 };

  expect(scoreYardQueueCandidate(expiresLater, weights, NOW, WAREHOUSE_DATE, false)).toMatchObject({
    factors: { cargoUrgency: 100 }, reasonCodes: ['EXPIRING_CARGO'], score: 5_500,
  });
  expect(scoreYardQueueCandidate(expiresToday, weights, NOW, WAREHOUSE_DATE, false).score).toBe(5_500);
  expect(scoreYardQueueCandidate(expired, weights, NOW, WAREHOUSE_DATE, false).score).toBe(0);
  expect(scoreYardQueueCandidate(expiresLater, weights, NOW, toCalendarDate(NOW, 'UTC'), false).score).toBe(0);
  expect(scoreYardQueueCandidate({ ...expiresToday, hasColdCargo: true }, weights, NOW, WAREHOUSE_DATE, false))
    .toMatchObject({ factors: { cargoUrgency: 100 }, reasonCodes: ['COLD_CARGO', 'EXPIRING_CARGO'], score: 5_500 });
});

it('keeps resource availability neutral until it is confirmed for all competing visits', () => {
  const earlier = createCandidate('earlier', { arrivedAtMs: NOW - 1, hasAvailableResources: false });
  const later = createCandidate('later', { arrivedAtMs: NOW, hasAvailableResources: true });
  const unknown = createCandidate('unknown');
  const weights = { ...zeroWeights, resourceAvailabilityWeight: 5 };

  expect(rankYardQueue([earlier, later], weights, NOW, WAREHOUSE_DATE)).toEqual([later, earlier]);
  expect(rankYardQueue([unknown, later, earlier], weights, NOW, WAREHOUSE_DATE)).toEqual([earlier, later, unknown]);
  expect(scoreYardQueueCandidate(later, weights, NOW, WAREHOUSE_DATE, true))
    .toMatchObject({ factors: { resourceAvailability: 100 }, reasonCodes: ['AVAILABLE_RESOURCES'], score: 500 });
});

it('resolves ties by enabled known deadline, actual arrival, and ID with missing facts last', () => {
  const earliest = createCandidate('a', { arrivedAtMs: NOW - 2 });
  const due = createCandidate('z', { arrivedAtMs: NOW, deliveryEndsAtMs: NOW + 120 * MINUTE_MS });
  const sameArrivalA = createCandidate('b', { arrivedAtMs: NOW });
  const sameArrivalB = createCandidate('c', { arrivedAtMs: NOW });
  const unknown = createCandidate('unknown');
  const visits = [unknown, sameArrivalB, due, earliest, sameArrivalA];

  expect(rankYardQueue(visits, { ...zeroWeights, deliveryWindowWeight: 25 }, NOW, WAREHOUSE_DATE))
    .toEqual([due, earliest, sameArrivalA, sameArrivalB, unknown]);
  expect(rankYardQueue(visits, zeroWeights, NOW, WAREHOUSE_DATE)).toEqual([earliest, sameArrivalA, sameArrivalB, due, unknown]);
});

it('returns a stable order for 30 visits regardless of input order', () => {
  const recent = Array.from({ length: 30 }, (_, index) => createCandidate(`visit-${String(index).padStart(2, '0')}`, {
    arrivedAtMs: NOW - Math.floor(index / 3) * MINUTE_MS,
    hasColdCargo: index % 2 === 0,
    isUrgent: index % 5 === 0,
  }));
  const ranked = rankYardQueue(recent, DEFAULT_YARD_QUEUE_WEIGHTS, NOW, WAREHOUSE_DATE);
  const reordered = rankYardQueue(recent.toReversed(), DEFAULT_YARD_QUEUE_WEIGHTS, NOW, WAREHOUSE_DATE);

  expect(ranked).toEqual(reordered);
  expect(new Set(ranked)).toEqual(new Set(recent));
});
