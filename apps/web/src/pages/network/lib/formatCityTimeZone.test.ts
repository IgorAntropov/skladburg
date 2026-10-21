import {
  describe,
  expect,
  it,
} from 'vitest';

import { formatCityTimeZone } from './formatCityTimeZone';

const WINTER_INSTANT = Date.UTC(2026, 0, 15, 12);

describe('formatCityTimeZone', () => {
  it('writes the offset of a zone as UTC with a sign', () => {
    expect(formatCityTimeZone('Europe/Moscow', WINTER_INSTANT)).toBe('UTC+3');
    expect(formatCityTimeZone('Asia/Yekaterinburg', WINTER_INSTANT)).toBe('UTC+5');
  });

  it('keeps the minutes of a half-hour zone', () => {
    expect(formatCityTimeZone('Asia/Kolkata', WINTER_INSTANT)).toBe('UTC+5:30');
  });

  it('writes plain UTC for the zero offset', () => {
    expect(formatCityTimeZone('UTC', WINTER_INSTANT)).toBe('UTC');
  });

  it('follows the daylight saving of the given instant', () => {
    expect(formatCityTimeZone('Europe/Berlin', WINTER_INSTANT)).toBe('UTC+1');
    expect(formatCityTimeZone('Europe/Berlin', Date.UTC(2026, 6, 15, 12))).toBe('UTC+2');
  });
});
