import type {
  CalendarDateValue,
  DateTimeFormatPartsValue,
  Translate,
  ZonedDateTimeOptionsValue,
} from '../localizer/localizationTypes';
import type { LocaleCode } from '../localizer/messageShape';

import { getDateTimeFormat } from './intlCache';

export interface ZonedFormatContextValue {
  locale: LocaleCode;
  t: Translate;
  userTimeZone: string;
}

const OFFSET_LOCALE: LocaleCode = 'en';
const OFFSET_PATTERN = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/u;
const DEFAULT_TIME_FORMAT: DateTimeFormatPartsValue = { hour: '2-digit', minute: '2-digit' };
const DEFAULT_DATE_FORMAT: DateTimeFormatPartsValue = { dateStyle: 'long' };

const formatOffset = (rawOffset: string): string => {
  const match = OFFSET_PATTERN.exec(rawOffset);
  const [, sign, hours, minutes] = match ?? [];

  if (sign === undefined || hours === undefined) {
    return 'UTC';
  }

  const minutesPart = minutes === undefined || minutes === '00' ? '' : `:${minutes}`;

  return `UTC${sign}${String(Number(hours))}${minutesPart}`;
};

const getOffsetLabel = (timeZone: string, instant: Date | number): string => {
  const parts = getDateTimeFormat(OFFSET_LOCALE, { timeZone, timeZoneName: 'longOffset' }).formatToParts(instant);
  const rawOffset = parts.find(part => part.type === 'timeZoneName')?.value ?? 'GMT';

  return formatOffset(rawOffset);
};

export const formatZonedDateTime = (
  { locale, t, userTimeZone }: ZonedFormatContextValue,
  instant: Date | number,
  { format = DEFAULT_TIME_FORMAT, placeName, timeZone }: ZonedDateTimeOptionsValue,
): string => {
  const text = getDateTimeFormat(locale, { ...format, timeZone }).format(instant);
  const offset = getOffsetLabel(timeZone, instant);

  if (offset === getOffsetLabel(userTimeZone, instant)) {
    return text;
  }

  return placeName === undefined || placeName === ''
    ? t('time.zoned_offset_only', { offset, time: text })
    : t('time.zoned_with_place', { offset, place: placeName, time: text });
};

export const formatCalendarDate = (
  locale: LocaleCode,
  { day, month, year }: CalendarDateValue,
  format: DateTimeFormatPartsValue = DEFAULT_DATE_FORMAT,
): string => {
  return getDateTimeFormat(locale, { ...format, timeZone: 'UTC' }).format(Date.UTC(year, month - 1, day));
};
