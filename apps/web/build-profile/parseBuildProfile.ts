import type {
  BuildProfileTenantValue,
  BuildProfileValue,
  TermMessageValue,
  TermOverridesValue,
} from './buildProfileTypes.ts';

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.length > 0;
};

const isTermMessage = (value: unknown): value is TermMessageValue => {
  return typeof value === 'string' || (isRecord(value) && Object.values(value).every((form: unknown) => typeof form === 'string'));
};

const isTermOverrides = (value: unknown): value is TermOverridesValue => {
  return isRecord(value) && Object.values(value).every((messages: unknown) => {
    return isRecord(messages) && Object.values(messages).every(isTermMessage);
  });
};

const createProfileError = (profileName: string, message: string): Error => {
  return new Error(`Build profile "${profileName}": ${message}`);
};

const canonicalizeLocale = (locale: string): string | undefined => {
  try {
    return Intl.getCanonicalLocales(locale)[0];
  }
  catch {
    return undefined;
  }
};

const assertCanonicalLocale = (locale: string, fieldName: string, profileName: string): void => {
  const canonicalLocale = canonicalizeLocale(locale);

  if (canonicalLocale === undefined) {
    throw createProfileError(profileName, `${fieldName} contains an invalid locale code "${locale}"`);
  }

  if (canonicalLocale !== locale) {
    throw createProfileError(
      profileName,
      `${fieldName} contains the locale code "${locale}" in a non-canonical form, use "${canonicalLocale}"`,
    );
  }
};

const parseLocaleList = (value: unknown, fieldName: string, profileName: string): string[] => {
  if (!isStringArray(value) || value.length === 0) {
    throw createProfileError(profileName, `${fieldName} must be a non-empty array of locale codes`);
  }

  for (const locale of value) {
    assertCanonicalLocale(locale, fieldName, profileName);
  }

  if (new Set(value).size !== value.length) {
    throw createProfileError(profileName, `${fieldName} must not contain duplicates`);
  }

  return value;
};

const parseRequiredString = (raw: RawRecord, fieldName: string, profileName: string): string => {
  const value = raw[fieldName];

  if (!isNonEmptyString(value)) {
    throw createProfileError(profileName, `defaultTenant.${fieldName} must be a non-empty string`);
  }

  return value;
};

const parseDefaultTenant = (
  raw: unknown,
  bundledLocales: readonly string[],
  profileName: string,
): BuildProfileTenantValue => {
  if (!isRecord(raw)) {
    throw createProfileError(profileName, 'defaultTenant must be an object');
  }

  const availableLocales = parseLocaleList(raw.availableLocales, 'defaultTenant.availableLocales', profileName);
  const brandName = parseRequiredString(raw, 'brandName', profileName);
  const defaultLocale = parseRequiredString(raw, 'defaultLocale', profileName);
  const tenantId = parseRequiredString(raw, 'tenantId', profileName);
  const termOverrides = raw.termOverrides;

  if (!isTermOverrides(termOverrides)) {
    throw createProfileError(
      profileName,
      'defaultTenant.termOverrides must map locale codes to messages (a string or an object of plural forms)',
    );
  }

  assertCanonicalLocale(defaultLocale, 'defaultTenant.defaultLocale', profileName);

  for (const locale of Object.keys(termOverrides)) {
    assertCanonicalLocale(locale, 'defaultTenant.termOverrides', profileName);
  }

  if (!availableLocales.includes(defaultLocale)) {
    throw createProfileError(profileName, `defaultTenant.defaultLocale "${defaultLocale}" is not in defaultTenant.availableLocales`);
  }

  if (!bundledLocales.includes(defaultLocale)) {
    throw createProfileError(profileName, `defaultTenant.defaultLocale "${defaultLocale}" is not in bundledLocales`);
  }

  return { availableLocales, brandName, defaultLocale, tenantId, termOverrides };
};

export const parseBuildProfile = (raw: unknown, profileName: string): BuildProfileValue => {
  if (!isRecord(raw)) {
    throw createProfileError(profileName, 'the profile must be a JSON object');
  }

  const bundledLocales = parseLocaleList(raw.bundledLocales, 'bundledLocales', profileName);
  const defaultTenant = parseDefaultTenant(raw.defaultTenant, bundledLocales, profileName);

  return { bundledLocales, defaultTenant };
};
