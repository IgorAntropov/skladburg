import type { CalendarDateValue } from '@/shared/i18n';

const ISO_DATE_PATTERN = /^(\d{4,6})-(\d{2})-(\d{2})$/;

const YEAR_DIGITS = 4;
const PART_DIGITS = 2;

export const parseIsoCalendarDate = (value: string): CalendarDateValue | undefined => {
  const match = ISO_DATE_PATTERN.exec(value);

  if (match === null) {
    return undefined;
  }

  return {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
};

export const formatIsoCalendarDate = ({ day, month, year }: CalendarDateValue): string => {
  const yearText = String(year).padStart(YEAR_DIGITS, '0');
  const monthText = String(month).padStart(PART_DIGITS, '0');
  const dayText = String(day).padStart(PART_DIGITS, '0');

  return `${yearText}-${monthText}-${dayText}`;
};
