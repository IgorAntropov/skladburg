import {
  describe,
  expect,
  it,
} from 'vitest';

import type { IBusinessCalendar } from '../../../calendar/index';

import {
  formatCalendarDateIso,
  getStartOfDayInstant,
  parseCalendarDate,
} from '../../../calendar/index';
import { RU_BUSINESS_CALENDAR } from '../../../calendar/ruBusinessCalendar';
import { computeEtaDate } from './etaDate';

const MOSCOW = 'Europe/Moscow';
const NOVOSIBIRSK = 'Asia/Novosibirsk';
const NOON_OFFSET_MS = 12 * 3_600_000;

const atMoscowNoon = (isoDate: string): number => getStartOfDayInstant(parseCalendarDate(isoDate), MOSCOW) + NOON_OFFSET_MS;

const eta = (
  isoDate: string,
  preparationWorkingDays: number,
  driveMinutes: number,
  timeZone: string = MOSCOW,
  calendar: IBusinessCalendar = RU_BUSINESS_CALENDAR,
): string | undefined => {
  const result = computeEtaDate({
    calendar,
    driveMinutes,
    preparationWorkingDays,
    timeZone,
    worldTimeMs: atMoscowNoon(isoDate),
  });

  return result === undefined ? undefined : formatCalendarDateIso(result);
};

describe('computeEtaDate', () => {
  it.each([
    ['the plan example: Monday, two preparation days, 970 minutes on the road', '2026-10-12', 2, 970, '2026-10-15'],
    ['a start on Saturday moves to Monday before the preparation', '2026-10-10', 1, 0, '2026-10-13'],
    ['a start on Sunday moves to Monday before the preparation', '2026-10-11', 0, 0, '2026-10-12'],
    ['a public holiday in the preparation window', '2026-11-03', 1, 0, '2026-11-05'],
    ['the new year holidays in the preparation window', '2026-12-29', 2, 0, '2027-01-11'],
    ['an arrival on Saturday moves to Monday', '2026-10-12', 3, 1081, '2026-10-19'],
    ['an arrival on a holiday moves to the next working day', '2026-11-02', 1, 541, '2026-11-05'],
    ['no preparation and no road', '2026-10-12', 0, 0, '2026-10-12'],
    ['exactly one driving shift', '2026-10-12', 0, 540, '2026-10-12'],
    ['one minute over a driving shift', '2026-10-12', 0, 541, '2026-10-13'],
    ['exactly two driving shifts', '2026-10-12', 0, 1080, '2026-10-13'],
  ])('computes %s', (_name, isoDate, preparationWorkingDays, driveMinutes, expected) => {
    expect(eta(isoDate, preparationWorkingDays, driveMinutes)).toBe(expected);
  });

  it('counts the road in calendar days, so a Friday departure with two days on the road lands on Monday', () => {
    expect(eta('2026-10-16', 0, 1081)).toBe('2026-10-19');
  });

  it('gives different days for one instant in Moscow and Novosibirsk', () => {
    const instant = Date.UTC(2026, 9, 16, 20);
    const compute = (timeZone: string): string | undefined => {
      const result = computeEtaDate({
        calendar: RU_BUSINESS_CALENDAR,
        driveMinutes: 0,
        preparationWorkingDays: 0,
        timeZone,
        worldTimeMs: instant,
      });

      return result === undefined ? undefined : formatCalendarDateIso(result);
    };

    expect(compute(MOSCOW)).toBe('2026-10-16');
    expect(compute(NOVOSIBIRSK)).toBe('2026-10-19');
  });

  it('uses the local day of the warehouse at its midnight boundary', () => {
    const startOfLocalMonday = getStartOfDayInstant(parseCalendarDate('2026-10-12'), NOVOSIBIRSK);
    const result = computeEtaDate({
      calendar: RU_BUSINESS_CALENDAR,
      driveMinutes: 0,
      preparationWorkingDays: 0,
      timeZone: NOVOSIBIRSK,
      worldTimeMs: startOfLocalMonday,
    });

    expect(result === undefined ? undefined : formatCalendarDateIso(result)).toBe('2026-10-12');
  });

  it.each([
    ['the preparation runs past the covered years', '2027-12-30', 1, 0],
    ['the road runs past the covered years', '2027-12-29', 0, 5000],
    ['the world time is before the covered years', '2025-06-10', 1, 0],
  ])('gives no date when %s', (_name, isoDate, preparationWorkingDays, driveMinutes) => {
    expect(eta(isoDate, preparationWorkingDays, driveMinutes)).toBeUndefined();
  });

  it('rethrows an error that is not a calendar range error', () => {
    const failingCalendar: IBusinessCalendar = {
      ...RU_BUSINESS_CALENDAR,
      isWorkingDay: () => {
        throw new Error('calendar failure');
      },
    };

    expect(() => eta('2026-10-12', 1, 0, MOSCOW, failingCalendar)).toThrow('calendar failure');
  });

  it('rethrows a plain range error such as negative preparation days', () => {
    expect(() => eta('2026-10-12', -1, 0)).toThrow(RangeError);
  });
});
