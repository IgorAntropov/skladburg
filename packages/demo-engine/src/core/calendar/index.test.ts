import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  addCalendarDays,
  BusinessCalendarRangeError,
  compareCalendarDates,
  createBusinessCalendar,
  formatCalendarDateIso,
  getIsoWeekday,
  getStartOfDayInstant,
  parseCalendarDate,
  RU_BUSINESS_CALENDAR,
  toCalendarDate,
} from './index';

describe('core/calendar public entry', () => {
  it('computes a deadline in the time zone of a warehouse', () => {
    const now = Date.UTC(2026, 10, 3, 15, 0);

    const moscowDay = toCalendarDate(now, 'Europe/Moscow');
    const vladivostokDay = toCalendarDate(now, 'Asia/Vladivostok');

    expect(RU_BUSINESS_CALENDAR.getCalendarDay(moscowDay)).toMatchObject({ kind: 'shortened', workingHours: 7 });
    expect(formatCalendarDateIso(vladivostokDay)).toBe('2026-11-04');
    expect(RU_BUSINESS_CALENDAR.getCalendarDay(vladivostokDay)).toMatchObject({ isWorking: false, kind: 'holiday' });
  });

  it('turns the end of a deadline into an instant', () => {
    const due = RU_BUSINESS_CALENDAR.addWorkingDays(parseCalendarDate('2026-10-12'), 3);

    expect(formatCalendarDateIso(due)).toBe('2026-10-15');
    expect(getStartOfDayInstant(addCalendarDays(due, 1), 'Asia/Vladivostok')).toBe(Date.UTC(2026, 9, 15, 14, 0));
  });

  it('exposes the helpers of calendar dates and the factory', () => {
    expect(compareCalendarDates(parseCalendarDate('2026-10-13'), parseCalendarDate('2026-10-12'))).toBeGreaterThan(0);
    expect(getIsoWeekday(parseCalendarDate('2026-10-12'))).toBe(1);
    expect(createBusinessCalendar([]).getCoveredYears()).toEqual([]);
    expect(() => RU_BUSINESS_CALENDAR.isWorkingDay(parseCalendarDate('2030-01-01'))).toThrow(BusinessCalendarRangeError);
  });
});
