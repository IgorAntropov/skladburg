import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  floorToWorldMinute,
  getMsIntoWorldMinute,
} from './worldMinute';

const MINUTE_START_MS = Date.UTC(2026, 9, 9, 12, 7, 0);

describe('worldMinute', () => {
  it('floors a time inside the minute to its start', () => {
    expect(floorToWorldMinute(MINUTE_START_MS + 59_999)).toBe(MINUTE_START_MS);
    expect(floorToWorldMinute(MINUTE_START_MS)).toBe(MINUTE_START_MS);
  });

  it('floors a time before the epoch down, not towards zero', () => {
    expect(floorToWorldMinute(-1)).toBe(-60_000);
    expect(floorToWorldMinute(-60_000)).toBe(-60_000);
    expect(getMsIntoWorldMinute(-45_000)).toBe(15_000);
  });

  it('floors a fractional time', () => {
    expect(floorToWorldMinute(MINUTE_START_MS + 1234.5)).toBe(MINUTE_START_MS);
    expect(getMsIntoWorldMinute(MINUTE_START_MS + 1234.5)).toBe(1234.5);
  });
});
