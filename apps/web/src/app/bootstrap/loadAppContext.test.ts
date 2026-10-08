import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  CatalogLoader,
  LocaleCatalogValue,
} from '@/shared/i18n';
import type { TenantSettingsValue } from '@/shared/tenant';

import { loadAppContext } from './loadAppContext';

const ruCatalog: LocaleCatalogValue = {
  ...defaultLocaleCatalog,
  'field.placeholder': 'Скоро здесь будет склад',
};

const enCatalog: LocaleCatalogValue = {
  ...defaultLocaleCatalog,
  'app.startError.message': 'The application failed to start',
  'app.startError.retry': 'Retry',
  'app.startError.retrying': 'Retrying…',
  'field.placeholder': 'A warehouse is coming soon',
  'units.pallet': { one: '{count} pallet', other: '{count} pallets' },
};

const northWarehouse: TenantSettingsValue = {
  availableLocales: ['ru', 'en'],
  brandName: 'Северный склад',
  defaultLocale: 'ru',
  tenantId: 'north-warehouse',
  termOverrides: {},
};

const createLoader = (catalog: LocaleCatalogValue): ReturnType<typeof vi.fn<CatalogLoader>> => {
  return vi.fn<CatalogLoader>(() => Promise.resolve(catalog));
};

describe('loadAppContext', () => {
  it('returns the tenant settings and a localizer in the default locale', async () => {
    const ruLoader = createLoader(ruCatalog);
    const enLoader = createLoader(enCatalog);

    const { localizer, tenantSettings } = await loadAppContext({
      bundledLocales: ['ru', 'en'],
      catalogLoaders: { en: enLoader, ru: ruLoader },
      defaultTenant: northWarehouse,
    });

    expect(tenantSettings).toEqual(northWarehouse);
    expect(localizer.getSnapshot().locale).toBe('ru');
    expect(localizer.getSnapshot().t('field.placeholder')).toBe('Скоро здесь будет склад');
    expect(ruLoader).toHaveBeenCalledOnce();
    expect(enLoader).not.toHaveBeenCalled();
  });

  it('applies the term overrides of the company', async () => {
    const { localizer } = await loadAppContext({
      bundledLocales: ['ru'],
      catalogLoaders: { ru: createLoader(ruCatalog) },
      defaultTenant: { ...northWarehouse, termOverrides: { ru: { 'field.placeholder': 'Склад откроется весной' } } },
    });

    expect(localizer.getSnapshot().t('field.placeholder')).toBe('Склад откроется весной');
  });

  it('falls back to the first bundled locale when the default one is not bundled', async () => {
    const { localizer } = await loadAppContext({
      bundledLocales: ['ru'],
      catalogLoaders: { ru: createLoader(ruCatalog) },
      defaultTenant: { ...northWarehouse, defaultLocale: 'en' },
    });

    expect(localizer.getSnapshot().locale).toBe('ru');
  });

  it('rejects when the catalog loader of the selected locale is missing', async () => {
    await expect(loadAppContext({
      bundledLocales: ['ru'],
      catalogLoaders: {},
      defaultTenant: northWarehouse,
    })).rejects.toBeInstanceOf(Error);
  });

  it('rejects when the catalog fails to load', async () => {
    await expect(loadAppContext({
      bundledLocales: ['ru'],
      catalogLoaders: { ru: () => Promise.reject(new Error('chunk is unavailable')) },
      defaultTenant: northWarehouse,
    })).rejects.toThrow('chunk is unavailable');
  });
});
