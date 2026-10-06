import type { LocaleCode } from '../localizer/messageShape';

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

const buildCacheKey = (locale: LocaleCode, options: object | undefined): string => {
  if (options === undefined) {
    return locale;
  }

  return `${locale}|${JSON.stringify(options, Object.keys(options).sort())}`;
};

const getCached = <Instance>(cache: Map<string, Instance>, key: string, create: () => Instance): Instance => {
  const cached = cache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const created = create();
  cache.set(key, created);

  return created;
};

export const getNumberFormat = (locale: LocaleCode, options?: Intl.NumberFormatOptions): Intl.NumberFormat => {
  return getCached(numberFormats, buildCacheKey(locale, options), () => new Intl.NumberFormat(locale, options));
};

export const getDateTimeFormat = (locale: LocaleCode, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  return getCached(dateTimeFormats, buildCacheKey(locale, options), () => new Intl.DateTimeFormat(locale, options));
};

export const getPluralRules = (locale: LocaleCode): Intl.PluralRules => {
  return getCached(pluralRules, locale, () => new Intl.PluralRules(locale));
};
