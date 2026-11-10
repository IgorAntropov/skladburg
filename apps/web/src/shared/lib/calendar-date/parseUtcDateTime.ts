import { parseIsoCalendarDate } from './calendarDateIso';

type UtcDateTimeValue
  = | { field: 'date' | 'time'; value?: undefined }
    | { field?: undefined; value: Date };

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const parseUtcDateTime = (date: string, rawTime: string): UtcDateTimeValue => {
  const parts = parseIsoCalendarDate(date);
  if (parts === undefined || parts.year < 1 || parts.year > 9999) {
    return { field: 'date' };
  }

  const calendarDay = new Date(0);
  calendarDay.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  if (calendarDay.toISOString().slice(0, 10) !== date) {
    return { field: 'date' };
  }

  const time = rawTime.trim();
  if (!TIME_PATTERN.test(time)) {
    return { field: 'time' };
  }

  calendarDay.setUTCHours(Number(time.slice(0, 2)), Number(time.slice(3)));
  return { value: calendarDay };
};
