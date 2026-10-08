import {
  describe,
  expect,
  it,
} from 'vitest';

import type { BuildProfileValue } from './buildProfileTypes.ts';

import {
  createCatalogImportPath,
  createProfileModuleSource,
} from './createProfileModuleSource.ts';

const STUB_CATALOG = { 'field.placeholder': 'Скоро' };

const createProfile = (bundledLocales: readonly string[], defaultLocale = 'ru'): BuildProfileValue => ({
  bundledLocales,
  defaultTenant: {
    availableLocales: ['ru', 'en'],
    brandName: 'Северный склад',
    defaultLocale,
    tenantId: 'f1000001-0000-4000-8000-000000000000',
    termOverrides: { ru: { 'field.placeholder': 'Скоро' } },
  },
});

interface ProfileModuleValue {
  bundledLocales: unknown;
  catalogLoaders: Record<string, unknown>;
  defaultLocaleCatalog: unknown;
  defaultTenant: unknown;
}

const isProfileModule = (value: unknown): value is ProfileModuleValue => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return ['bundledLocales', 'catalogLoaders', 'defaultLocaleCatalog', 'defaultTenant'].every(name => name in value);
};

const STUB_CATALOG_URL = `data:text/javascript,${encodeURIComponent(`export const catalog = ${JSON.stringify(STUB_CATALOG)};`)}`;

const isCatalogLoader = (value: unknown): value is () => Promise<unknown> => typeof value === 'function';

const importSource = async (source: string, defaultLocale = 'ru'): Promise<ProfileModuleValue> => {
  const executableSource = source.replace(JSON.stringify(createCatalogImportPath(defaultLocale)), JSON.stringify(STUB_CATALOG_URL));
  const module: unknown = await import(`data:text/javascript,${encodeURIComponent(executableSource)}`);

  if (!isProfileModule(module)) {
    throw new Error('Generated module has no expected exports');
  }

  return module;
};

describe('createProfileModuleSource', () => {
  it('exports the bundled locales and the default tenant', async () => {
    const profile = createProfile(['ru']);

    const module = await importSource(createProfileModuleSource(profile));

    expect(module.bundledLocales).toEqual(['ru']);
    expect(module.defaultTenant).toEqual(profile.defaultTenant);
  });

  it('creates a loader only for the locales of the profile', async () => {
    const module = await importSource(createProfileModuleSource(createProfile(['ru'])));

    expect(Object.keys(module.catalogLoaders)).toEqual(['ru']);
  });

  it('creates a loader for every locale of a multi-language profile', async () => {
    const module = await importSource(createProfileModuleSource(createProfile(['ru', 'en'])));

    expect(Object.keys(module.catalogLoaders)).toEqual(['ru', 'en']);
  });

  it('imports the catalog of the default locale statically by a path relative to the application root', () => {
    const source = createProfileModuleSource(createProfile(['ru', 'en']));

    expect(source).toContain('import { catalog as defaultLocaleCatalog } from "/src/shared/i18n/catalogs/ru.ts";');
    expect(source).not.toContain('import("/src/shared/i18n/catalogs/ru.ts")');
  });

  it('imports the catalogs of the other locales lazily by paths relative to the application root', () => {
    const source = createProfileModuleSource(createProfile(['ru', 'en']));

    expect(source).toContain('import("/src/shared/i18n/catalogs/en.ts").then((module) => module.catalog)');
    expect(source).not.toMatch(/^import .*catalogs\/en\.ts/m);
  });

  it('resolves the loader of the default locale with the statically imported catalog', async () => {
    const module = await importSource(createProfileModuleSource(createProfile(['ru', 'en'])));
    const loader = module.catalogLoaders.ru;

    if (!isCatalogLoader(loader)) {
      throw new Error('The loader of the default locale is missing');
    }

    expect(module.defaultLocaleCatalog).toEqual(STUB_CATALOG);
    expect(await loader()).toBe(module.defaultLocaleCatalog);
  });

  it('treats the default locale of the profile as the static one even when it is not the first', async () => {
    const profile = createProfile(['ru', 'en'], 'en');
    const source = createProfileModuleSource(profile);
    const module = await importSource(source, 'en');

    expect(source).toContain('import { catalog as defaultLocaleCatalog } from "/src/shared/i18n/catalogs/en.ts";');
    expect(source).toContain('import("/src/shared/i18n/catalogs/ru.ts")');
    expect(Object.keys(module.catalogLoaders)).toEqual(['ru', 'en']);
  });

  it('does not mention locales outside of the profile', () => {
    const source = createProfileModuleSource(createProfile(['ru']));

    expect(source).not.toContain('catalogs/en.ts');
  });
});
