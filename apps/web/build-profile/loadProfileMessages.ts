import { join } from 'node:path';
import { runnerImport } from 'vite';

import type { sanitizeOverrides } from '../src/shared/i18n/translation/sanitizeOverrides.ts';
import type { BuildProfileValue } from './buildProfileTypes.ts';

import { CATALOGS_DIRECTORY } from './buildProfilePaths.ts';

export interface LoadProfileMessagesOptionsValue<TKey extends string> {
  appRoot: string;
  keys: readonly TKey[];
  profile: BuildProfileValue;
}

interface CatalogModuleValue {
  catalog?: unknown;
}

interface SanitizeOverridesModuleValue {
  sanitizeOverrides: typeof sanitizeOverrides;
}

const SANITIZE_OVERRIDES_MODULE_PATH = join(import.meta.dirname, '../src/shared/i18n/translation/sanitizeOverrides.ts');

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readOwnString = (record: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  if (!Object.hasOwn(record, key)) {
    return undefined;
  }

  const value = record[key];

  return typeof value === 'string' ? value : undefined;
};

const importModule = async <TModule>(modulePath: string, appRoot: string): Promise<TModule> => {
  const { module } = await runnerImport<TModule>(modulePath, { logLevel: 'silent', root: appRoot });

  return module;
};

const loadCatalog = async (catalogPath: string, appRoot: string): Promise<Readonly<Record<string, unknown>>> => {
  const module = await importModule<CatalogModuleValue>(catalogPath, appRoot);

  if (!isRecord(module.catalog)) {
    throw new Error(`Catalog ${catalogPath} must export "catalog" as an object`);
  }

  return module.catalog;
};

export const loadProfileMessages = async <TKey extends string>({
  appRoot,
  keys,
  profile,
}: LoadProfileMessagesOptionsValue<TKey>): Promise<Readonly<Record<TKey, string>>> => {
  const { defaultLocale, termOverrides } = profile.defaultTenant;
  const catalogPath = join(appRoot, CATALOGS_DIRECTORY, `${defaultLocale}.ts`);
  const catalog = await loadCatalog(catalogPath, appRoot);
  const baseMessages: Partial<Record<TKey, string>> = {};

  for (const key of keys) {
    const message = readOwnString(catalog, key);

    if (message === undefined) {
      throw new Error(`Message "${key}" is missing or is not a string in ${catalogPath}`);
    }

    baseMessages[key] = message;
  }

  const localeOverrides = Object.hasOwn(termOverrides, defaultLocale) ? termOverrides[defaultLocale] : undefined;
  const { sanitizeOverrides } = await importModule<SanitizeOverridesModuleValue>(SANITIZE_OVERRIDES_MODULE_PATH, appRoot);
  const overrides = sanitizeOverrides(localeOverrides, baseMessages, defaultLocale);
  const messages: Partial<Record<TKey, string>> = {};

  for (const key of keys) {
    const override = overrides[key];

    messages[key] = typeof override === 'string' ? override : baseMessages[key];
  }

  return messages as Record<TKey, string>;
};
