import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  BusinessCalendarRangeError,
  type CalendarDateValue,
  CalendarDayKind,
  formatCalendarDateIso,
  getStartOfDayInstant,
  parseCalendarDate,
  RU_BUSINESS_CALENDAR,
  toCalendarDate,
} from './index';

interface DecreeValue {
  extraDaysOff: readonly string[];
  shortenedWorkingDays: readonly string[];
  workingWeekends: readonly string[];
}

interface ReferenceDayValue {
  hours: number;
  isWorking: boolean;
}

const MILLISECONDS_PER_DAY = 86_400_000;
const FULL_WORKING_HOURS = 8;
const SHORTENED_WORKING_HOURS = 7;
const SATURDAY = 6;
const SUNDAY = 0;

const STATUTORY_HOLIDAYS_BY_MONTH_DAY: ReadonlySet<string> = new Set([
  '01-01',
  '01-02',
  '01-03',
  '01-04',
  '01-05',
  '01-06',
  '01-07',
  '01-08',
  '02-23',
  '03-08',
  '05-01',
  '05-09',
  '06-12',
  '11-04',
]);

const DECREES_BY_YEAR: Readonly<Record<number, DecreeValue>> = {
  2026: {
    extraDaysOff: ['2026-01-09', '2026-12-31'],
    shortenedWorkingDays: [],
    workingWeekends: [],
  },
  2027: {
    extraDaysOff: ['2027-02-22', '2027-11-05', '2027-12-31'],
    shortenedWorkingDays: ['2027-02-20'],
    workingWeekends: ['2027-02-20'],
  },
};

const EXPECTED_YEAR_TOTALS = {
  calendarDays: 365,
  nonWorkingDays: 118,
  workingDays: 247,
  workingHours: 1972,
};

const date = (isoDate: string): CalendarDateValue => parseCalendarDate(isoDate);

const toUtcMs = (isoDate: string): number => {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);

  return Date.UTC(year, month - 1, day);
};

const toIso = (utcMs: number): string => new Date(utcMs).toISOString().slice(0, 10);

const shiftIso = (isoDate: string, days: number): string => toIso(toUtcMs(isoDate) + days * MILLISECONDS_PER_DAY);

const isWeekendIso = (isoDate: string): boolean => {
  const weekday = new Date(toUtcMs(isoDate)).getUTCDay();

  return weekday === SATURDAY || weekday === SUNDAY;
};

const isStatutoryHoliday = (isoDate: string): boolean => STATUTORY_HOLIDAYS_BY_MONTH_DAY.has(isoDate.slice(5));

const listYearDates = (year: number): string[] => {
  const dates: string[] = [];
  const endMs = Date.UTC(year + 1, 0, 1);

  for (let utcMs = Date.UTC(year, 0, 1); utcMs < endMs; utcMs += MILLISECONDS_PER_DAY) {
    dates.push(toIso(utcMs));
  }

  return dates;
};

const findTransferredDaysOff = (year: number, decree: DecreeValue): Set<string> => {
  const transferred = new Set<string>();
  const januaryPrefix = `${String(year)}-01`;
  const nonJanuaryHolidays = listYearDates(year).filter(isoDate => isStatutoryHoliday(isoDate) && !isoDate.startsWith(januaryPrefix));

  for (const holiday of nonJanuaryHolidays) {
    if (!isWeekendIso(holiday)) {
      continue;
    }

    let candidate = shiftIso(holiday, 1);

    while (
      isWeekendIso(candidate)
      || isStatutoryHoliday(candidate)
      || transferred.has(candidate)
      || decree.extraDaysOff.includes(candidate)
    ) {
      candidate = shiftIso(candidate, 1);
    }

    transferred.add(candidate);
  }

  return transferred;
};

const buildReferenceYear = (year: number): Map<string, ReferenceDayValue> => {
  const decree = DECREES_BY_YEAR[year];

  if (decree === undefined) {
    throw new Error(`No reference decree for ${String(year)}`);
  }

  const transferred = findTransferredDaysOff(year, decree);
  const reference = new Map<string, ReferenceDayValue>();

  for (const isoDate of listYearDates(year)) {
    const isWorkingWeekend = decree.workingWeekends.includes(isoDate);
    const isDayOff = isStatutoryHoliday(isoDate)
      || transferred.has(isoDate)
      || decree.extraDaysOff.includes(isoDate)
      || (isWeekendIso(isoDate) && !isWorkingWeekend);

    if (isDayOff) {
      reference.set(isoDate, { hours: 0, isWorking: false });
      continue;
    }

    const isShortened = isStatutoryHoliday(shiftIso(isoDate, 1)) || decree.shortenedWorkingDays.includes(isoDate);

    reference.set(isoDate, {
      hours: isShortened ? SHORTENED_WORKING_HOURS : FULL_WORKING_HOURS,
      isWorking: true,
    });
  }

  return reference;
};

const summarize = (days: readonly ReferenceDayValue[]): typeof EXPECTED_YEAR_TOTALS => ({
  calendarDays: days.length,
  nonWorkingDays: days.filter(day => !day.isWorking).length,
  workingDays: days.filter(day => day.isWorking).length,
  workingHours: days.reduce((sum, day) => sum + day.hours, 0),
});

const readCalendarYear = (year: number): ReferenceDayValue[] => listYearDates(year).map((isoDate) => {
  const day = RU_BUSINESS_CALENDAR.getCalendarDay(date(isoDate));

  return { hours: day.workingHours, isWorking: day.isWorking };
});

const addWorkingDaysIso = (isoDate: string, count: number): string => {
  const result = RU_BUSINESS_CALENDAR.addWorkingDays(date(isoDate), count);

  return formatCalendarDateIso(result);
};

describe('Russian business calendar golden dates', () => {
  it('covers exactly the years 2026 and 2027', () => {
    expect(RU_BUSINESS_CALENDAR.getCoveredYears()).toEqual([2026, 2027]);
  });

  describe('days off moved by Labor Code art. 112 and the government decrees', () => {
    it.each([
      ['2026-01-09', 'Friday, moved from Saturday 3 January by decree 1466'],
      ['2026-03-09', 'Monday, 8 March fell on Sunday'],
      ['2026-05-11', 'Monday, 9 May fell on Saturday'],
      ['2026-12-31', 'Thursday, moved from Sunday 4 January by decree 1466'],
      ['2027-02-22', 'Monday, moved from Saturday 20 February by decree 1187'],
      ['2027-05-03', 'Monday, 1 May fell on Saturday'],
      ['2027-05-10', 'Monday, 9 May fell on Sunday'],
      ['2027-06-14', 'Monday, 12 June fell on Saturday'],
      ['2027-11-05', 'Friday, moved from Saturday 2 January by decree 1187'],
      ['2027-12-31', 'Friday, moved from Sunday 3 January by decree 1187'],
    ])('treats %s as a non-working day (%s)', (isoDate) => {
      const day = RU_BUSINESS_CALENDAR.getCalendarDay(date(isoDate));

      expect(day.isWorking).toBe(false);
      expect(day.workingHours).toBe(0);
      expect(RU_BUSINESS_CALENDAR.isWorkingDay(date(isoDate))).toBe(false);
    });

    it('treats Saturday 2027-02-20 as a working day shortened to 7 hours', () => {
      const day = RU_BUSINESS_CALENDAR.getCalendarDay(date('2027-02-20'));

      expect(day.isWorking).toBe(true);
      expect(day.workingHours).toBe(SHORTENED_WORKING_HOURS);
      expect(day.kind).toBe(CalendarDayKind.SHORTENED);
      expect(RU_BUSINESS_CALENDAR.isWorkingDay(date('2027-02-20'))).toBe(true);
    });
  });

  describe('days shortened by one hour before a holiday (art. 95)', () => {
    it.each([
      '2026-04-30',
      '2026-05-08',
      '2026-06-11',
      '2026-11-03',
      '2027-02-20',
      '2027-04-30',
      '2027-06-11',
      '2027-11-03',
    ])('gives %s seven working hours', (isoDate) => {
      const day = RU_BUSINESS_CALENDAR.getCalendarDay(date(isoDate));

      expect(day.isWorking).toBe(true);
      expect(day.workingHours).toBe(SHORTENED_WORKING_HOURS);
      expect(day.kind).toBe(CalendarDayKind.SHORTENED);
    });

    it.each([
      ['2027-03-05', 'Friday, but Saturday 6 March separates it from the holiday'],
      ['2027-05-07', 'Friday, but Saturday 8 May separates it from the holiday'],
      ['2026-12-30', 'next day is a transferred day off, not a holiday'],
      ['2027-12-30', 'next day is a transferred day off, not a holiday'],
      ['2026-02-20', 'Friday, weekend separates it from the holiday'],
    ])('gives %s eight working hours (%s)', (isoDate) => {
      const day = RU_BUSINESS_CALENDAR.getCalendarDay(date(isoDate));

      expect(day.isWorking).toBe(true);
      expect(day.workingHours).toBe(FULL_WORKING_HOURS);
      expect(day.kind).toBe(CalendarDayKind.WORKING);
    });
  });

  describe('working day arithmetic', () => {
    it('counts 10 working days from the Friday before the February holidays to 2026-03-10', () => {
      expect(addWorkingDaysIso('2026-02-20', 10)).toBe('2026-03-10');
      expect(RU_BUSINESS_CALENDAR.countWorkingDays(date('2026-02-20'), date('2026-03-10'))).toBe(10);
    });

    it('carries working days across the year boundary to 2027-01-12', () => {
      expect(addWorkingDaysIso('2026-12-29', 3)).toBe('2027-01-12');
      expect(addWorkingDaysIso('2026-12-29', 1)).toBe('2026-12-30');
      expect(addWorkingDaysIso('2026-12-29', 2)).toBe('2027-01-11');
      expect(RU_BUSINESS_CALENDAR.countWorkingDays(date('2026-12-29'), date('2027-01-12'))).toBe(3);
    });

    it('treats every day from 2026-12-31 to 2027-01-10 as non-working and 2027-01-11 as working', () => {
      const nonWorkingRun = Array.from({ length: 11 }, (_, offset) => shiftIso('2026-12-31', offset));

      expect(nonWorkingRun[0]).toBe('2026-12-31');
      expect(nonWorkingRun[10]).toBe('2027-01-10');
      expect(nonWorkingRun.filter(isoDate => RU_BUSINESS_CALENDAR.isWorkingDay(date(isoDate)))).toEqual([]);
      expect(RU_BUSINESS_CALENDAR.isWorkingDay(date('2027-01-11'))).toBe(true);
      expect(RU_BUSINESS_CALENDAR.getCalendarDay(date('2027-01-11')).workingHours).toBe(FULL_WORKING_HOURS);
    });
  });

  describe.each([2026, 2027])('year %i totals', (year) => {
    it('has 365 calendar days, 247 working days, 118 non-working days and 1972 working hours', () => {
      expect(summarize(readCalendarYear(year))).toEqual(EXPECTED_YEAR_TOTALS);
    });

    it('matches the independent reference of the rules for every day', () => {
      const reference = buildReferenceYear(year);

      expect(summarize([...reference.values()])).toEqual(EXPECTED_YEAR_TOTALS);

      const mismatches = [...reference.entries()]
        .map(([isoDate, expected]) => {
          const actual = RU_BUSINESS_CALENDAR.getCalendarDay(date(isoDate));

          return {
            actual: { hours: actual.workingHours, isWorking: actual.isWorking },
            expected,
            isoDate,
          };
        })
        .filter(entry => entry.actual.hours !== entry.expected.hours || entry.actual.isWorking !== entry.expected.isWorking);

      expect(mismatches).toEqual([]);
    });

    it('counts the working days of the whole year through countWorkingDays', () => {
      const newYearHolidayOfFirstCoveredYear = date('2026-01-01');
      const lastDayOfPreviousCoveredYear = date('2026-12-31');
      const intervalStart = year === 2026 ? newYearHolidayOfFirstCoveredYear : lastDayOfPreviousCoveredYear;

      expect(RU_BUSINESS_CALENDAR.countWorkingDays(intervalStart, date(`${String(year)}-12-31`))).toBe(EXPECTED_YEAR_TOTALS.workingDays);
    });
  });

  describe('dates in the time zone of the object', () => {
    const instantMs = Date.UTC(2026, 10, 3, 15, 0, 0);

    it('is the shortened working day 2026-11-03 for a warehouse in Moscow', () => {
      const calendarDate = toCalendarDate(instantMs, 'Europe/Moscow');
      const day = RU_BUSINESS_CALENDAR.getCalendarDay(calendarDate);

      expect(formatCalendarDateIso(calendarDate)).toBe('2026-11-03');
      expect(day.isWorking).toBe(true);
      expect(day.workingHours).toBe(SHORTENED_WORKING_HOURS);
      expect(day.kind).toBe(CalendarDayKind.SHORTENED);
    });

    it('is the holiday 2026-11-04 for a warehouse in Vladivostok', () => {
      const calendarDate = toCalendarDate(instantMs, 'Asia/Vladivostok');
      const day = RU_BUSINESS_CALENDAR.getCalendarDay(calendarDate);

      expect(formatCalendarDateIso(calendarDate)).toBe('2026-11-04');
      expect(day.isWorking).toBe(false);
      expect(day.workingHours).toBe(0);
    });

    it('starts the holiday 2026-11-04 in Vladivostok at 2026-11-03T14:00:00Z', () => {
      expect(getStartOfDayInstant(date('2026-11-04'), 'Asia/Vladivostok')).toBe(Date.UTC(2026, 10, 3, 14, 0, 0));
    });
  });

  describe('dates outside the covered years', () => {
    it.each(['2025-12-31', '2028-01-01'])('throws BusinessCalendarRangeError for getCalendarDay on %s', (isoDate) => {
      expect(() => RU_BUSINESS_CALENDAR.getCalendarDay(date(isoDate))).toThrow(BusinessCalendarRangeError);
    });

    it.each(['2025-12-31', '2028-01-01'])('throws BusinessCalendarRangeError for isWorkingDay on %s', (isoDate) => {
      expect(() => RU_BUSINESS_CALENDAR.isWorkingDay(date(isoDate))).toThrow(BusinessCalendarRangeError);
    });

    it('throws BusinessCalendarRangeError when adding 5 working days from 2027-12-29 runs past 2027', () => {
      expect(() => RU_BUSINESS_CALENDAR.addWorkingDays(date('2027-12-29'), 5)).toThrow(BusinessCalendarRangeError);
    });

    it('throws BusinessCalendarRangeError when counting into 2028', () => {
      expect(() => RU_BUSINESS_CALENDAR.countWorkingDays(date('2027-12-29'), date('2028-01-10'))).toThrow(BusinessCalendarRangeError);
    });
  });
});
