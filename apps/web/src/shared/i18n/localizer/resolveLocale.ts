import type { ResolveLocaleOptionsValue } from './localizationTypes';
import type { LocaleCode } from './messageShape';

export const resolveLocale = ({ bundledLocales, requestedLocale, tenant }: ResolveLocaleOptionsValue): LocaleCode => {
  const isInBundle = (locale: LocaleCode): boolean => bundledLocales.includes(locale);

  if (requestedLocale !== undefined && isInBundle(requestedLocale) && tenant.availableLocales.includes(requestedLocale)) {
    return requestedLocale;
  }

  if (isInBundle(tenant.defaultLocale)) {
    return tenant.defaultLocale;
  }

  const firstSharedLocale = tenant.availableLocales.find(isInBundle);

  if (firstSharedLocale !== undefined) {
    return firstSharedLocale;
  }

  const [firstBundledLocale] = bundledLocales;

  if (firstBundledLocale === undefined) {
    throw new Error('Cannot resolve locale: no locales are bundled');
  }

  return firstBundledLocale;
};
