import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  BusinessCalendarDataError,
  BusinessCalendarRangeError,
  createBusinessCalendar,
  RU_BUSINESS_CALENDAR,
} from './businessCalendar';
import {
  type CalendarDateValue,
  fromEpochDay,
  parseCalendarDate,
  toEpochDay,
} from './calendarDate';
import {
  type BusinessCalendarYearValue,
  CalendarBasisKind,
  type CalendarDayExceptionValue,
  CalendarDayKind,
  type CalendarDayKindValue,
  CalendarYearStatus,
} from './calendarTypes';
import { RU_BUSINESS_CALENDAR_YEARS } from './ruBusinessCalendarData';

const date = (isoDate: string): CalendarDateValue => parseCalendarDate(isoDate);

const toKind = (value: string): CalendarDayKindValue => value as CalendarDayKindValue;

const createYear = (
  exceptions: readonly CalendarDayExceptionValue[],
  year = 2026,
  overrides: Partial<BusinessCalendarYearValue> = {},
): BusinessCalendarYearValue => ({
  basis: [
    {
      articles: ['112'],
      date: '2001-12-30',
      kind: CalendarBasisKind.LABOR_CODE,
      number: '197-ФЗ',
      title: 'Трудовой кодекс Российской Федерации',
    },
  ],
  exceptions,
  status: CalendarYearStatus.APPROVED,
  verifiedBy: ['test'],
  version: `${String(year)}.1`,
  year,
  ...overrides,
});

interface YearTotalsValue {
  hours: number;
  workingDays: number;
}

const sumYear = (year: number): YearTotalsValue => {
  const firstEpochDay = toEpochDay({ day: 1, month: 1, year });
  const lastEpochDay = toEpochDay({ day: 1, month: 1, year: year + 1 });
  let hours = 0;
  let workingDays = 0;

  for (let epochDay = firstEpochDay; epochDay < lastEpochDay; epochDay += 1) {
    const day = RU_BUSINESS_CALENDAR.getCalendarDay(fromEpochDay(epochDay));

    hours += day.workingHours;
    workingDays += day.isWorking ? 1 : 0;
  }

  return { hours, workingDays };
};

describe('RU_BUSINESS_CALENDAR', () => {
  it('covers 2026 and 2027', () => {
    expect(RU_BUSINESS_CALENDAR.getCoveredYears()).toEqual([2026, 2027]);
  });

  it.each([2026, 2027])('has 247 working days and 1972 hours in %i', (year) => {
    expect(sumYear(year)).toEqual({ hours: 1972, workingDays: 247 });
  });

  it('gives a copy of the covered years', () => {
    const years = RU_BUSINESS_CALENDAR.getCoveredYears();

    expect(years).not.toBe(RU_BUSINESS_CALENDAR.getCoveredYears());
  });

  describe('getCalendarDay', () => {
    it('describes an ordinary working day', () => {
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2026-10-12'))).toEqual({
        basis: undefined,
        date: { day: 12, month: 10, year: 2026 },
        isWorking: true,
        kind: CalendarDayKind.WORKING,
        version: '2026.1',
        workingHours: 8,
      });
    });

    it('describes an ordinary Saturday and Sunday', () => {
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2026-10-17'))).toMatchObject({
        basis: undefined,
        isWorking: false,
        kind: CalendarDayKind.WEEKEND,
        workingHours: 0,
      });
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2026-10-18')).isWorking).toBe(false);
    });

    it('describes a holiday that falls on a weekday', () => {
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2026-02-23'))).toMatchObject({
        basis: CalendarBasisKind.LABOR_CODE,
        isWorking: false,
        kind: CalendarDayKind.HOLIDAY,
        workingHours: 0,
      });
    });

    it('describes a holiday that falls on a weekend', () => {
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2026-03-08'))).toMatchObject({
        isWorking: false,
        kind: CalendarDayKind.HOLIDAY,
      });
    });

    it('describes a day off moved by the decree', () => {
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2026-01-09'))).toMatchObject({
        basis: CalendarBasisKind.GOVERNMENT_DECREE,
        isWorking: false,
        kind: CalendarDayKind.WEEKEND,
      });
    });

    it('describes a day off moved by the Labor Code', () => {
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2026-03-09'))).toMatchObject({
        basis: CalendarBasisKind.LABOR_CODE,
        isWorking: false,
        kind: CalendarDayKind.WEEKEND,
      });
    });

    it('describes a shortened day with seven hours', () => {
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2026-11-03'))).toMatchObject({
        basis: CalendarBasisKind.LABOR_CODE,
        isWorking: true,
        kind: CalendarDayKind.SHORTENED,
        workingHours: 7,
      });
    });

    it('describes the working Saturday of 2027', () => {
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2027-02-20'))).toMatchObject({
        basis: CalendarBasisKind.GOVERNMENT_DECREE,
        isWorking: true,
        kind: CalendarDayKind.SHORTENED,
        version: '2027.1',
        workingHours: 7,
      });
    });

    it('keeps the days before a holiday that are not shortened by law at eight hours', () => {
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2027-03-05')).workingHours).toBe(8);
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2027-05-07')).workingHours).toBe(8);
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2026-12-30')).workingHours).toBe(8);
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2027-12-30')).workingHours).toBe(8);
    });

    it('returns a copy of the requested date', () => {
      const requested = date('2026-10-12');

      expect(RU_BUSINESS_CALENDAR.getCalendarDay(requested).date).not.toBe(requested);
    });

    it('throws a range error outside of the covered years', () => {
      expect(() => RU_BUSINESS_CALENDAR.getCalendarDay(date('2025-12-31'))).toThrow(BusinessCalendarRangeError);
      expect(() => RU_BUSINESS_CALENDAR.getCalendarDay(date('2028-01-01'))).toThrow(BusinessCalendarRangeError);
    });

    it('throws a range error for a date that does not exist', () => {
      expect(() => RU_BUSINESS_CALENDAR.getCalendarDay({ day: 30, month: 2, year: 2026 })).toThrow(RangeError);
    });
  });

  describe('isWorkingDay', () => {
    it.each([
      ['2026-01-09', false],
      ['2026-03-09', false],
      ['2026-11-03', true],
      ['2026-11-04', false],
      ['2026-12-31', false],
      ['2027-01-11', true],
      ['2027-02-20', true],
      ['2027-02-22', false],
      ['2027-12-31', false],
    ])('answers for %s', (isoDate, expected) => {
      expect(RU_BUSINESS_CALENDAR.isWorkingDay(date(isoDate))).toBe(expected);
    });

    it('throws a range error outside of the covered years', () => {
      expect(() => RU_BUSINESS_CALENDAR.isWorkingDay(date('2028-06-01'))).toThrow(BusinessCalendarRangeError);
    });
  });

  describe('addWorkingDays', () => {
    it('returns the same date for zero days', () => {
      expect(RU_BUSINESS_CALENDAR.addWorkingDays(date('2026-10-17'), 0)).toEqual({ day: 17, month: 10, year: 2026 });
    });

    it('does not count the start date', () => {
      expect(RU_BUSINESS_CALENDAR.addWorkingDays(date('2026-10-12'), 1)).toEqual({ day: 13, month: 10, year: 2026 });
    });

    it('skips a weekend', () => {
      expect(RU_BUSINESS_CALENDAR.addWorkingDays(date('2026-10-16'), 1)).toEqual({ day: 19, month: 10, year: 2026 });
    });

    it('counts from a non-working day', () => {
      expect(RU_BUSINESS_CALENDAR.addWorkingDays(date('2026-10-17'), 1)).toEqual({ day: 19, month: 10, year: 2026 });
    });

    it('goes across the new year of 2027', () => {
      expect(RU_BUSINESS_CALENDAR.addWorkingDays(date('2026-12-29'), 3)).toEqual({ day: 12, month: 1, year: 2027 });
    });

    it('counts a working Saturday', () => {
      expect(RU_BUSINESS_CALENDAR.addWorkingDays(date('2027-02-19'), 1)).toEqual({ day: 20, month: 2, year: 2027 });
      expect(RU_BUSINESS_CALENDAR.addWorkingDays(date('2027-02-20'), 1)).toEqual({ day: 24, month: 2, year: 2027 });
    });

    it('gives the tenth working day after the Friday before the holidays', () => {
      expect(RU_BUSINESS_CALENDAR.addWorkingDays(date('2026-02-20'), 10)).toEqual({ day: 10, month: 3, year: 2026 });
    });

    it('does not change the argument', () => {
      const source = date('2026-10-12');

      RU_BUSINESS_CALENDAR.addWorkingDays(source, 5);

      expect(source).toEqual({ day: 12, month: 10, year: 2026 });
    });

    it('throws a range error when the count leaves the covered years', () => {
      expect(() => RU_BUSINESS_CALENDAR.addWorkingDays(date('2027-12-30'), 1)).toThrow(BusinessCalendarRangeError);
      expect(() => RU_BUSINESS_CALENDAR.addWorkingDays(date('2027-12-01'), 40)).toThrow(BusinessCalendarRangeError);
    });

    it('reaches the last working day of 2027', () => {
      expect(RU_BUSINESS_CALENDAR.addWorkingDays(date('2027-12-29'), 0)).toEqual({ day: 29, month: 12, year: 2027 });
      expect(RU_BUSINESS_CALENDAR.addWorkingDays(date('2027-12-29'), 1)).toEqual({ day: 30, month: 12, year: 2027 });
    });

    it('throws a range error when the start is outside of the covered years, even for zero days', () => {
      expect(() => RU_BUSINESS_CALENDAR.addWorkingDays(date('2025-12-31'), 0)).toThrow(BusinessCalendarRangeError);
      expect(() => RU_BUSINESS_CALENDAR.addWorkingDays(date('2028-01-01'), 3)).toThrow(BusinessCalendarRangeError);
    });

    it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s days', (count) => {
      expect(() => RU_BUSINESS_CALENDAR.addWorkingDays(date('2026-10-12'), count)).toThrow(RangeError);
    });
  });

  describe('countWorkingDays', () => {
    it('counts the half-open interval after the start date', () => {
      expect(RU_BUSINESS_CALENDAR.countWorkingDays(date('2026-10-12'), date('2026-10-16'))).toBe(4);
    });

    it('gives zero for the same date', () => {
      expect(RU_BUSINESS_CALENDAR.countWorkingDays(date('2026-10-12'), date('2026-10-12'))).toBe(0);
    });

    it('counts the end date when it is a working day', () => {
      expect(RU_BUSINESS_CALENDAR.countWorkingDays(date('2026-10-16'), date('2026-10-19'))).toBe(1);
    });

    it('gives zero over a weekend', () => {
      expect(RU_BUSINESS_CALENDAR.countWorkingDays(date('2026-10-16'), date('2026-10-18'))).toBe(0);
    });

    it('counts over the new year of 2027', () => {
      expect(RU_BUSINESS_CALENDAR.countWorkingDays(date('2026-12-29'), date('2027-01-12'))).toBe(3);
    });

    it('counts the working days of the whole year after its first day', () => {
      expect(RU_BUSINESS_CALENDAR.countWorkingDays(date('2026-01-01'), date('2026-12-31'))).toBe(247);
    });

    it('rejects an interval that ends before it starts', () => {
      expect(() => RU_BUSINESS_CALENDAR.countWorkingDays(date('2026-10-13'), date('2026-10-12'))).toThrow(RangeError);
    });

    it('throws a range error when an end is outside of the covered years', () => {
      expect(() => RU_BUSINESS_CALENDAR.countWorkingDays(date('2027-12-01'), date('2028-01-10'))).toThrow(BusinessCalendarRangeError);
      expect(() => RU_BUSINESS_CALENDAR.countWorkingDays(date('2025-12-01'), date('2026-01-10'))).toThrow(BusinessCalendarRangeError);
    });
  });

  describe('addWorkingDays and countWorkingDays together', () => {
    it('count back exactly the added days for every date of 2026 and every n from 0 to 30', () => {
      const firstEpochDay = toEpochDay({ day: 1, month: 1, year: 2026 });
      const lastEpochDay = toEpochDay({ day: 1, month: 1, year: 2027 });

      for (let epochDay = firstEpochDay; epochDay < lastEpochDay; epochDay += 1) {
        const start = fromEpochDay(epochDay);

        for (let count = 0; count <= 30; count += 1) {
          const end = RU_BUSINESS_CALENDAR.addWorkingDays(start, count);

          expect(RU_BUSINESS_CALENDAR.countWorkingDays(start, end), `${String(epochDay)} + ${String(count)}`).toBe(count);
          expect(RU_BUSINESS_CALENDAR.isWorkingDay(end) || count === 0).toBe(true);
        }
      }
    });
  });
});

describe('RU_BUSINESS_CALENDAR_YEARS', () => {
  it.each(RU_BUSINESS_CALENDAR_YEARS)('describes the year $year with a version, status, sources and documents', (yearData) => {
    expect(yearData.status).toBe(CalendarYearStatus.APPROVED);
    expect(yearData.version).toBe(`${String(yearData.year)}.1`);
    expect(yearData.verifiedBy).toEqual(['КонсультантПлюс', 'Гарант']);
    expect(yearData.basis.map(document => document.kind)).toEqual([CalendarBasisKind.LABOR_CODE, CalendarBasisKind.GOVERNMENT_DECREE]);
  });

  it('refers to the decrees by number, date and title', () => {
    const decrees = RU_BUSINESS_CALENDAR_YEARS.map(yearData =>
      yearData.basis.find(document => document.kind === CalendarBasisKind.GOVERNMENT_DECREE),
    );

    expect(decrees).toEqual([
      expect.objectContaining({ date: '2025-09-24', number: '1466', title: 'О переносе выходных дней в 2026 году' }),
      expect.objectContaining({ date: '2026-09-17', number: '1187', title: 'О переносе выходных дней в 2027 году' }),
    ]);
  });

  it('refers to the Labor Code articles 95 and 112', () => {
    const codes = RU_BUSINESS_CALENDAR_YEARS.map(yearData =>
      yearData.basis.find(document => document.kind === CalendarBasisKind.LABOR_CODE),
    );

    for (const code of codes) {
      expect(code?.articles).toEqual(['95', '112']);
    }
  });

  it('lists the exceptions in the order of dates inside each year', () => {
    for (const yearData of RU_BUSINESS_CALENDAR_YEARS) {
      const dates = yearData.exceptions.map(exception => exception.date);

      expect(dates).toEqual([...dates].sort());
    }
  });
});

describe('createBusinessCalendar', () => {
  it('builds a calendar from years given in any order', () => {
    const calendar = createBusinessCalendar([createYear([], 2027), createYear([], 2026)]);

    expect(calendar.getCoveredYears()).toEqual([2026, 2027]);
  });

  it('applies the five-day week where there are no exceptions', () => {
    const calendar = createBusinessCalendar([createYear([])]);

    expect(calendar.isWorkingDay(date('2026-01-01'))).toBe(true);
    expect(calendar.isWorkingDay(date('2026-01-03'))).toBe(false);
    expect(calendar.countWorkingDays(date('2026-01-01'), date('2026-12-31'))).toBe(260);
  });

  it('accepts a working day exception without shortening', () => {
    const calendar = createBusinessCalendar([
      createYear([{ basis: CalendarBasisKind.LABOR_CODE, date: '2026-01-03', kind: CalendarDayKind.WORKING }]),
    ]);

    expect(calendar.getCalendarDay(date('2026-01-03'))).toMatchObject({ isWorking: true, kind: CalendarDayKind.WORKING, workingHours: 8 });
  });

  it('accepts a calendar without years and refuses every date', () => {
    const calendar = createBusinessCalendar([]);

    expect(calendar.getCoveredYears()).toEqual([]);
    expect(() => calendar.isWorkingDay(date('2026-01-01'))).toThrow(BusinessCalendarRangeError);
  });

  it('keeps the draft status and the version of the year in the days', () => {
    const calendar = createBusinessCalendar([createYear([], 2030, { status: CalendarYearStatus.DRAFT, version: '2030.0-draft' })]);

    expect(calendar.getCalendarDay(date('2030-03-04')).version).toBe('2030.0-draft');
  });

  it('keeps calendars independent from each other', () => {
    const narrow = createBusinessCalendar([createYear([])]);

    expect(narrow.getCoveredYears()).toEqual([2026]);
    expect(RU_BUSINESS_CALENDAR.getCoveredYears()).toEqual([2026, 2027]);
  });

  describe('data errors', () => {
    const holiday = (isoDate: string): CalendarDayExceptionValue => ({
      basis: CalendarBasisKind.LABOR_CODE,
      date: isoDate,
      kind: CalendarDayKind.HOLIDAY,
    });

    it('rejects an exception outside of its year', () => {
      expect(() => createBusinessCalendar([createYear([holiday('2027-01-01')])])).toThrow(BusinessCalendarDataError);
    });

    it('rejects a duplicate date in a year', () => {
      expect(() => createBusinessCalendar([createYear([holiday('2026-01-01'), holiday('2026-01-01')])])).toThrow(BusinessCalendarDataError);
    });

    it.each(['2026-02-30', '2026-1-1', 'январь', ''])('rejects the malformed date %j', (isoDate) => {
      expect(() => createBusinessCalendar([createYear([holiday(isoDate)])])).toThrow(BusinessCalendarDataError);
    });

    it('rejects an unknown kind of day', () => {
      const exceptions = [{ basis: CalendarBasisKind.LABOR_CODE, date: '2026-01-01', kind: toKind('sick') }];

      expect(() => createBusinessCalendar([createYear(exceptions)])).toThrow(BusinessCalendarDataError);
    });

    it('rejects a basis that has no document in the year', () => {
      const exceptions = [{ basis: CalendarBasisKind.GOVERNMENT_DECREE, date: '2026-01-09', kind: CalendarDayKind.WEEKEND }];

      expect(() => createBusinessCalendar([createYear(exceptions)])).toThrow(BusinessCalendarDataError);
    });

    it('rejects a year listed twice', () => {
      expect(() => createBusinessCalendar([createYear([]), createYear([])])).toThrow(BusinessCalendarDataError);
    });

    it('rejects an empty version', () => {
      expect(() => createBusinessCalendar([createYear([], 2026, { version: ' ' })])).toThrow(BusinessCalendarDataError);
    });

    it('rejects a year that is not an integer', () => {
      expect(() => createBusinessCalendar([createYear([], 2026.5)])).toThrow(BusinessCalendarDataError);
    });

    it('names the year and the date in the message', () => {
      expect(() => createBusinessCalendar([createYear([holiday('2027-01-01')])])).toThrow(/2026.*2027-01-01/);
    });
  });
});
