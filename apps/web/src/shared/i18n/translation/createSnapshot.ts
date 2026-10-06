import type {
  I18nSnapshotValue,
  LocaleCatalogValue,
  TenantLocalizationValue,
} from '../localizer/localizationTypes';
import type { LocaleCode } from '../localizer/messageShape';

import {
  createTranslate,
  createTranslator,
} from './createTranslator';
import {
  getDateTimeFormat,
  getNumberFormat,
} from './intlCache';
import { sanitizeOverrides } from './sanitizeOverrides';

export const createSnapshot = (
  locale: LocaleCode,
  catalog: LocaleCatalogValue,
  tenant: TenantLocalizationValue,
): I18nSnapshotValue => {
  const overrides = sanitizeOverrides(tenant.termOverrides[locale], catalog, locale);

  return Object.freeze({
    formatCurrency: (amount: number, currencyCode: string): string => {
      return getNumberFormat(locale, { currency: currencyCode, style: 'currency' }).format(amount);
    },
    formatDate: (date: Date, options?: Intl.DateTimeFormatOptions): string => {
      return getDateTimeFormat(locale, options).format(date);
    },
    formatNumber: (amount: number, options?: Intl.NumberFormatOptions): string => {
      return getNumberFormat(locale, options).format(amount);
    },
    locale,
    t: createTranslate(createTranslator({ layers: [catalog, overrides], locale })),
  });
};
