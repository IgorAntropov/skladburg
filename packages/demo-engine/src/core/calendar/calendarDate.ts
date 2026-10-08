export interface CalendarDateValue {
  day: number;
  month: number;
  year: number;
}

const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_WEEKDAY_OF_EPOCH_DAY_ZERO = 4;
const DAYS_PER_WEEK = 7;

const toUtcMs = (year: number, month: number, day: number): number => {
  const date = new Date(0);

  date.setUTCFullYear(year, month - 1, day);

  return date.getTime();
};

const isExistingDate = (year: number, month: number, day: number): boolean => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = new Date(toUtcMs(year, month, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const formatCalendarDateForMessage = (date: CalendarDateValue): string => `${String(date.year)}-${String(date.month)}-${String(date.day)}`;

const assertExistingDate = (date: CalendarDateValue): void => {
  if (!isExistingDate(date.year, date.month, date.day)) {
    throw new RangeError(`Calendar date does not exist: ${formatCalendarDateForMessage(date)}`);
  }
};

export const toEpochDay = (date: CalendarDateValue): number => {
  assertExistingDate(date);

  return Math.round(toUtcMs(date.year, date.month, date.day) / MILLISECONDS_PER_DAY);
};

export const fromEpochDay = (epochDay: number): CalendarDateValue => {
  if (!Number.isInteger(epochDay)) {
    throw new RangeError(`Epoch day must be an integer, got ${String(epochDay)}`);
  }

  const date = new Date(epochDay * MILLISECONDS_PER_DAY);

  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
};

export const getIsoWeekdayOfEpochDay = (epochDay: number): number => {
  const shifted = (epochDay + ISO_WEEKDAY_OF_EPOCH_DAY_ZERO - 1) % DAYS_PER_WEEK;

  return (shifted + DAYS_PER_WEEK) % DAYS_PER_WEEK + 1;
};

export const parseCalendarDate = (isoDate: string): CalendarDateValue => {
  const match = ISO_DATE_PATTERN.exec(isoDate);

  if (match === null) {
    throw new RangeError(`Calendar date must look like YYYY-MM-DD, got "${isoDate}"`);
  }

  const date: CalendarDateValue = {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };

  if (!isExistingDate(date.year, date.month, date.day)) {
    throw new RangeError(`Calendar date does not exist: "${isoDate}"`);
  }

  return date;
};

export const formatCalendarDateIso = (date: CalendarDateValue): string => {
  assertExistingDate(date);

  const year = String(date.year).padStart(4, '0');
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const addCalendarDays = (date: CalendarDateValue, days: number): CalendarDateValue => {
  if (!Number.isInteger(days)) {
    throw new RangeError(`Days to add must be an integer, got ${String(days)}`);
  }

  return fromEpochDay(toEpochDay(date) + days);
};

export const compareCalendarDates = (current: CalendarDateValue, prev: CalendarDateValue): number => toEpochDay(current) - toEpochDay(prev);

export const getIsoWeekday = (date: CalendarDateValue): number => getIsoWeekdayOfEpochDay(toEpochDay(date));
