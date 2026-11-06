import {
  type CalendarDateValue,
  fromEpochDay,
  getIsoWeekdayOfEpochDay,
  parseCalendarDate,
  toEpochDay,
} from './calendarDate';
import {
  type BusinessCalendarYearValue,
  CalendarBasisKind,
  type CalendarDayBasisValue,
  CalendarDayKind,
  type CalendarDayKindValue,
  type CalendarDayValue,
  CalendarYearStatus,
} from './calendarTypes';

export interface IBusinessCalendar {
  addWorkingDays: (after: CalendarDateValue, count: number) => CalendarDateValue;
  countWorkingDays: (after: CalendarDateValue, through: CalendarDateValue) => number;
  getCalendarDay: (date: CalendarDateValue) => CalendarDayValue;
  getCoveredYears: () => readonly number[];
  isWorkingDay: (date: CalendarDateValue) => boolean;
}

interface PreparedExceptionValue {
  basis: CalendarDayBasisValue;
  kind: CalendarDayKindValue;
}

interface PreparedYearValue {
  endEpochDay: number;
  exceptions: ReadonlyMap<number, PreparedExceptionValue>;
  startEpochDay: number;
  version: string;
  year: number;
}

export class BusinessCalendarDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BusinessCalendarDataError';
  }
}

export class BusinessCalendarRangeError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessCalendarRangeError';
  }
}

const KNOWN_KINDS: ReadonlySet<string> = new Set(Object.values(CalendarDayKind));
const KNOWN_BASES: ReadonlySet<string> = new Set(Object.values(CalendarBasisKind));
const KNOWN_STATUSES: ReadonlySet<string> = new Set(Object.values(CalendarYearStatus));

const WORKING_HOURS_BY_KIND: Readonly<Record<CalendarDayKindValue, number>> = {
  [CalendarDayKind.HOLIDAY]: 0,
  [CalendarDayKind.SHORTENED]: 7,
  [CalendarDayKind.WEEKEND]: 0,
  [CalendarDayKind.WORKING]: 8,
};

const FIRST_WEEKEND_ISO_WEEKDAY = 6;

const isKindWorking = (kind: CalendarDayKindValue): boolean => kind === CalendarDayKind.SHORTENED || kind === CalendarDayKind.WORKING;

const parseExceptionDate = (isoDate: string, year: number): CalendarDateValue => {
  try {
    return parseCalendarDate(isoDate);
  }
  catch (error) {
    throw new BusinessCalendarDataError(`Calendar ${String(year)}: invalid exception date "${isoDate}"`, { cause: error });
  }
};

const prepareExceptions = (yearData: BusinessCalendarYearValue): Map<number, PreparedExceptionValue> => {
  const exceptions = new Map<number, PreparedExceptionValue>();
  const documentKinds = new Set<string>(yearData.basis.map(document => document.kind));

  for (const exception of yearData.exceptions) {
    const date = parseExceptionDate(exception.date, yearData.year);

    if (date.year !== yearData.year) {
      throw new BusinessCalendarDataError(`Calendar ${String(yearData.year)}: exception ${exception.date} belongs to another year`);
    }

    if (!KNOWN_KINDS.has(exception.kind)) {
      throw new BusinessCalendarDataError(`Calendar ${String(yearData.year)}: unknown day kind "${exception.kind}" at ${exception.date}`);
    }

    if (!KNOWN_BASES.has(exception.basis)) {
      throw new BusinessCalendarDataError(`Calendar ${String(yearData.year)}: unknown basis "${exception.basis}" at ${exception.date}`);
    }

    if (!documentKinds.has(exception.basis)) {
      throw new BusinessCalendarDataError(
        `Calendar ${String(yearData.year)}: ${exception.date} refers to the basis "${exception.basis}" that has no document`,
      );
    }

    const epochDay = toEpochDay(date);

    if (exceptions.has(epochDay)) {
      throw new BusinessCalendarDataError(`Calendar ${String(yearData.year)}: duplicate exception at ${exception.date}`);
    }

    exceptions.set(epochDay, { basis: exception.basis, kind: exception.kind });
  }

  return exceptions;
};

const prepareYear = (yearData: BusinessCalendarYearValue): PreparedYearValue => {
  if (!Number.isInteger(yearData.year)) {
    throw new BusinessCalendarDataError(`Calendar year must be an integer, got ${String(yearData.year)}`);
  }

  if (yearData.version.trim() === '') {
    throw new BusinessCalendarDataError(`Calendar ${String(yearData.year)}: version is empty`);
  }

  if (!KNOWN_STATUSES.has(yearData.status)) {
    throw new BusinessCalendarDataError(`Calendar ${String(yearData.year)}: unknown status "${yearData.status}"`);
  }

  return {
    endEpochDay: toEpochDay({ day: 1, month: 1, year: yearData.year + 1 }),
    exceptions: prepareExceptions(yearData),
    startEpochDay: toEpochDay({ day: 1, month: 1, year: yearData.year }),
    version: yearData.version,
    year: yearData.year,
  };
};

export const createBusinessCalendar = (years: readonly BusinessCalendarYearValue[]): IBusinessCalendar => {
  const preparedYears = years.map(prepareYear).toSorted((current, prev) => current.year - prev.year);

  for (const [index, preparedYear] of preparedYears.entries()) {
    if (index > 0 && preparedYears[index - 1]?.year === preparedYear.year) {
      throw new BusinessCalendarDataError(`Calendar year ${String(preparedYear.year)} is listed twice`);
    }
  }

  const coveredYears: readonly number[] = preparedYears.map(preparedYear => preparedYear.year);

  const findYear = (epochDay: number): PreparedYearValue => {
    for (const preparedYear of preparedYears) {
      if (epochDay >= preparedYear.startEpochDay && epochDay < preparedYear.endEpochDay) {
        return preparedYear;
      }
    }
    const year = String(fromEpochDay(epochDay).year);

    throw new BusinessCalendarRangeError(`Business calendar does not cover the year ${year}; covered: ${coveredYears.join(', ')}`);
  };

  const assertCovered = (epochDay: number): void => {
    findYear(epochDay);
  };

  const resolveDayKind = (epochDay: number, exception: PreparedExceptionValue | undefined): CalendarDayKindValue =>
    exception?.kind ?? (getIsoWeekdayOfEpochDay(epochDay) >= FIRST_WEEKEND_ISO_WEEKDAY ? CalendarDayKind.WEEKEND : CalendarDayKind.WORKING);

  const isWorkingEpochDay = (epochDay: number): boolean =>
    isKindWorking(resolveDayKind(epochDay, findYear(epochDay).exceptions.get(epochDay)));

  const getCalendarDay = (date: CalendarDateValue): CalendarDayValue => {
    const epochDay = toEpochDay(date);
    const preparedYear = findYear(epochDay);
    const exception = preparedYear.exceptions.get(epochDay);
    const kind = resolveDayKind(epochDay, exception);

    return {
      basis: exception?.basis,
      date: { day: date.day, month: date.month, year: date.year },
      isWorking: isKindWorking(kind),
      kind,
      version: preparedYear.version,
      workingHours: WORKING_HOURS_BY_KIND[kind],
    };
  };

  const addWorkingDays = (after: CalendarDateValue, count: number): CalendarDateValue => {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`Working days to add must be a non-negative integer, got ${String(count)}`);
    }

    const startEpochDay = toEpochDay(after);

    assertCovered(startEpochDay);

    let epochDay = startEpochDay;
    let remaining = count;

    while (remaining > 0) {
      epochDay += 1;

      if (isWorkingEpochDay(epochDay)) {
        remaining -= 1;
      }
    }

    return fromEpochDay(epochDay);
  };

  const countWorkingDays = (after: CalendarDateValue, through: CalendarDateValue): number => {
    const firstEpochDay = toEpochDay(after);
    const lastEpochDay = toEpochDay(through);

    if (lastEpochDay < firstEpochDay) {
      throw new RangeError('The end of the interval is earlier than its start');
    }

    assertCovered(firstEpochDay);
    assertCovered(lastEpochDay);

    let count = 0;

    for (let epochDay = firstEpochDay + 1; epochDay <= lastEpochDay; epochDay += 1) {
      if (isWorkingEpochDay(epochDay)) {
        count += 1;
      }
    }

    return count;
  };

  return {
    addWorkingDays,
    countWorkingDays,
    getCalendarDay,
    getCoveredYears: (): readonly number[] => [...coveredYears],
    isWorkingDay: (date: CalendarDateValue): boolean => isWorkingEpochDay(toEpochDay(date)),
  };
};
