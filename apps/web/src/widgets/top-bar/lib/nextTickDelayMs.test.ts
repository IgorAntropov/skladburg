import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  MIN_TICK_DELAY_MS,
  nextTickDelayMs,
} from './nextTickDelayMs';

const MINUTE_START_MS = Date.UTC(2026, 9, 9, 12, 7, 0);

describe('nextTickDelayMs', () => {
  it('waits a whole minute at the scale 1 right on the minute boundary', () => {
    expect(nextTickDelayMs(MINUTE_START_MS, 1)).toBe(60_000);
  });

  it('waits the rest of the minute at the scale 1 in the middle of the minute', () => {
    expect(nextTickDelayMs(MINUTE_START_MS + 45_000, 1)).toBe(15_000);
  });

  it('rounds the wait up to a whole millisecond', () => {
    expect(nextTickDelayMs(MINUTE_START_MS + 59_999.4, 1)).toBe(MIN_TICK_DELAY_MS);
    expect(nextTickDelayMs(MINUTE_START_MS + 20_000.5, 1)).toBe(40_000);
    expect(nextTickDelayMs(MINUTE_START_MS + 20_000.5, 3)).toBe(13_334);
  });

  it('shortens the wait by the scale', () => {
    expect(nextTickDelayMs(MINUTE_START_MS, 2)).toBe(30_000);
    expect(nextTickDelayMs(MINUTE_START_MS + 30_000, 2)).toBe(15_000);
  });

  it('clamps the wait to one second on a large scale', () => {
    expect(nextTickDelayMs(MINUTE_START_MS, 60)).toBe(MIN_TICK_DELAY_MS);
    expect(nextTickDelayMs(MINUTE_START_MS + 10_000, 600)).toBe(MIN_TICK_DELAY_MS);
    expect(nextTickDelayMs(MINUTE_START_MS, 3600)).toBe(MIN_TICK_DELAY_MS);
  });

  it('does not clamp when the wait is just above one second', () => {
    expect(nextTickDelayMs(MINUTE_START_MS, 59)).toBe(1017);
  });

  it('has no wait on pause', () => {
    expect(nextTickDelayMs(MINUTE_START_MS, 0)).toBeUndefined();
  });

  it('has no wait for a negative or not finite scale', () => {
    expect(nextTickDelayMs(MINUTE_START_MS, -1)).toBeUndefined();
    expect(nextTickDelayMs(MINUTE_START_MS, Number.NaN)).toBeUndefined();
    expect(nextTickDelayMs(MINUTE_START_MS, Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('counts the minute boundary correctly before the epoch', () => {
    expect(nextTickDelayMs(-45_000, 1)).toBe(45_000);
    expect(nextTickDelayMs(-60_000, 1)).toBe(60_000);
    expect(nextTickDelayMs(-1, 1)).toBe(MIN_TICK_DELAY_MS);
  });

  it('counts the minute boundary correctly for a fractional world time', () => {
    expect(nextTickDelayMs(MINUTE_START_MS + 30_000.25, 1)).toBe(30_000);
  });
});
