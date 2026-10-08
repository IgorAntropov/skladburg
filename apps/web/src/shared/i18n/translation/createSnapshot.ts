import type {
  CalendarDateValue,
  DateTimeFormatPartsValue,
  I18nSnapshotValue,
  LocaleCatalogValue,
  TenantLocalizationValue,
  ZonedDateTimeOptionsValue,
} from '../localizer/localizationTypes';
import type { LocaleCode } from '../localizer/messageShape';
import type { ZonedFormatContextValue } from './formatZonedDateTime';

import {
  createTranslate,
  createTranslator,
} from './createTranslator';
import {
  formatCalendarDate,
  formatZonedDateTime,
} from './formatZonedDateTime';
import { getNumberFormat } from './intlCache';
import { sanitizeOverrides } from './sanitizeOverrides';

export const createSnapshot = (
  locale: LocaleCode,
  catalog: LocaleCatalogValue,
  tenant: TenantLocalizationValue,
  userTimeZone: string,
): I18nSnapshotValue => {
  const overrides = sanitizeOverrides(tenant.termOverrides[locale], catalog, locale);
  const t = createTranslate(createTranslator({ layers: [catalog, overrides], locale }));
  const zonedContext: ZonedFormatContextValue = { locale, t, userTimeZone };

  return Object.freeze({
    formatCalendarDate: (date: CalendarDateValue, format?: DateTimeFormatPartsValue): string => formatCalendarDate(locale, date, format),
    formatCurrency: (amount: number, currencyCode: string): string => {
      return getNumberFormat(locale, { currency: currencyCode, style: 'currency' }).format(amount);
    },
    formatDateTime: (instant: Date | number, options: ZonedDateTimeOptionsValue): string => {
      return formatZonedDateTime(zonedContext, instant, options);
    },
    formatNumber: (amount: number, options?: Intl.NumberFormatOptions): string => {
      return getNumberFormat(locale, options).format(amount);
    },
    locale,
    t,
    userTimeZone,
  });
};
