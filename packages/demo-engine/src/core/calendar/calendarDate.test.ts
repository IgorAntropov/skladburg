import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  addCalendarDays,
  compareCalendarDates,
  formatCalendarDateIso,
  fromEpochDay,
  getIsoWeekday,
  parseCalendarDate,
  toEpochDay,
} from './calendarDate';

describe('parseCalendarDate', () => {
  it('reads a strict ISO date', () => {
    expect(parseCalendarDate('2026-10-12')).toEqual({ day: 12, month: 10, year: 2026 });
  });

  it('accepts the last day of a leap February', () => {
    expect(parseCalendarDate('2028-02-29')).toEqual({ day: 29, month: 2, year: 2028 });
  });

  it.each([
    '2026-02-30',
    '2027-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-01-00',
  ])('rejects the date that does not exist %s', (value) => {
    expect(() => parseCalendarDate(value)).toThrow(RangeError);
  });

  it.each([
    '',
    '2026-1-1',
    '26-01-01',
    '2026/01/01',
    '2026-01-01T00:00:00Z',
    ' 2026-01-01',
    '2026-01-01 ',
    '20260101',
    '+2026-01-01',
  ])('rejects the text that is not YYYY-MM-DD %j', (value) => {
    expect(() => parseCalendarDate(value)).toThrow(RangeError);
  });
});

describe('formatCalendarDateIso', () => {
  it('pads month and day', () => {
    expect(formatCalendarDateIso({ day: 3, month: 1, year: 2026 })).toBe('2026-01-03');
  });

  it('round-trips with parseCalendarDate', () => {
    expect(formatCalendarDateIso(parseCalendarDate('2027-12-31'))).toBe('2027-12-31');
  });

  it('rejects a date that does not exist', () => {
    expect(() => formatCalendarDateIso({ day: 30, month: 2, year: 2026 })).toThrow(RangeError);
  });
});

describe('addCalendarDays', () => {
  it('adds days inside a month', () => {
    expect(addCalendarDays({ day: 12, month: 10, year: 2026 }, 3)).toEqual({ day: 15, month: 10, year: 2026 });
  });

  it('crosses a year boundary forward', () => {
    expect(addCalendarDays({ day: 30, month: 12, year: 2026 }, 3)).toEqual({ day: 2, month: 1, year: 2027 });
  });

  it('crosses a year boundary backward', () => {
    expect(addCalendarDays({ day: 2, month: 1, year: 2027 }, -3)).toEqual({ day: 30, month: 12, year: 2026 });
  });

  it('crosses a leap February', () => {
    expect(addCalendarDays({ day: 28, month: 2, year: 2028 }, 1)).toEqual({ day: 29, month: 2, year: 2028 });
    expect(addCalendarDays({ day: 28, month: 2, year: 2027 }, 1)).toEqual({ day: 1, month: 3, year: 2027 });
  });

  it('returns an equal date for zero days', () => {
    expect(addCalendarDays({ day: 5, month: 6, year: 2026 }, 0)).toEqual({ day: 5, month: 6, year: 2026 });
  });

  it('does not change the argument', () => {
    const source = { day: 1, month: 1, year: 2026 };

    addCalendarDays(source, 10);

    expect(source).toEqual({ day: 1, month: 1, year: 2026 });
  });

  it.each([0.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s days', (days) => {
    expect(() => addCalendarDays({ day: 1, month: 1, year: 2026 }, days)).toThrow(RangeError);
  });

  it('rejects a source date that does not exist', () => {
    expect(() => addCalendarDays({ day: 31, month: 4, year: 2026 }, 1)).toThrow(RangeError);
  });
});

describe('compareCalendarDates', () => {
  it('is negative when the current date is earlier', () => {
    expect(compareCalendarDates({ day: 31, month: 12, year: 2026 }, { day: 1, month: 1, year: 2027 })).toBeLessThan(0);
  });

  it('is positive when the current date is later', () => {
    expect(compareCalendarDates({ day: 1, month: 1, year: 2027 }, { day: 31, month: 12, year: 2026 })).toBeGreaterThan(0);
  });

  it('is zero for equal dates', () => {
    expect(compareCalendarDates({ day: 12, month: 10, year: 2026 }, { day: 12, month: 10, year: 2026 })).toBe(0);
  });

  it('orders by year before month and day', () => {
    expect(compareCalendarDates({ day: 1, month: 1, year: 2027 }, { day: 31, month: 12, year: 2026 })).toBe(1);
  });
});

describe('getIsoWeekday', () => {
  it.each([
    ['2026-10-12', 1],
    ['2026-10-13', 2],
    ['2026-10-14', 3],
    ['2026-10-15', 4],
    ['2026-10-16', 5],
    ['2026-10-17', 6],
    ['2026-10-18', 7],
    ['2026-01-01', 4],
    ['2027-01-01', 5],
    ['1970-01-01', 4],
    ['1969-12-31', 3],
    ['2028-02-29', 2],
  ])('gives the weekday of %s', (isoDate, weekday) => {
    expect(getIsoWeekday(parseCalendarDate(isoDate))).toBe(weekday);
  });

  it('agrees with the weekday of the native UTC date for every day of 2026 and 2027', () => {
    const firstEpochDay = toEpochDay({ day: 1, month: 1, year: 2026 });

    for (let offset = 0; offset < 730; offset += 1) {
      const date = fromEpochDay(firstEpochDay + offset);
      const nativeWeekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();

      expect(getIsoWeekday(date)).toBe(nativeWeekday === 0 ? 7 : nativeWeekday);
    }
  });
});

describe('epoch days', () => {
  it('maps 1970-01-01 to zero', () => {
    expect(toEpochDay({ day: 1, month: 1, year: 1970 })).toBe(0);
  });

  it('is reversible', () => {
    const date = { day: 29, month: 2, year: 2028 };

    expect(fromEpochDay(toEpochDay(date))).toEqual(date);
  });

  it('rejects a fractional epoch day', () => {
    expect(() => fromEpochDay(1.5)).toThrow(RangeError);
  });
});
