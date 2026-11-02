import type { CalendarDate } from '@skladburg/contracts/common/v1/date';

import type {
  CalendarDateValue,
  DateTimeFormatPartsValue,
} from '@/shared/i18n';

export type FormatCalendarDateFunction = (date: CalendarDateValue, format?: DateTimeFormatPartsValue) => string;

const ETA_DATE_FORMAT: DateTimeFormatPartsValue = { day: 'numeric', month: 'long', weekday: 'short' };

export const formatEtaDate = (
  formatCalendarDate: FormatCalendarDateFunction,
  etaDate: CalendarDate | undefined,
): string | undefined => {
  if (etaDate === undefined || etaDate.year === 0) {
    return undefined;
  }

  return formatCalendarDate(etaDate, ETA_DATE_FORMAT);
};
