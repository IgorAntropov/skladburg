import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  CatalogLoader,
  LocaleCatalogValue,
  LocalizerOptionsValue,
  TenantLocalizationValue,
} from './localizationTypes';

import { catalog as ruCatalog } from '../catalogs/ru';
import { createLocalizer } from './createLocalizer';

const enCatalog: LocaleCatalogValue = {
  ...ruCatalog,
  'app.startError.message': 'Failed to start the application',
  'app.startError.retry': 'Retry',
  'app.startError.retrying': 'Retrying…',
  'field.placeholder': 'A living world is coming soon',
  'units.pallet': { one: '{count} pallet', other: '{count} pallets' },
};

const deCatalog: LocaleCatalogValue = {
  ...ruCatalog,
  'app.startError.message': 'Anwendung konnte nicht gestartet werden',
  'app.startError.retry': 'Wiederholen',
  'app.startError.retrying': 'Wiederholung…',
  'field.placeholder': 'Bald entsteht hier eine lebendige Welt',
  'units.pallet': { one: '{count} Palette', other: '{count} Paletten' },
};

interface DeferredValue<Value> {
  promise: Promise<Value>;
  resolve: (value: Value) => void;
}

const createDeferred = <Value>(): DeferredValue<Value> => {
  let resolveDeferred: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((resolve) => {
    resolveDeferred = resolve;
  });

  return { promise, resolve: resolveDeferred };
};

const createTenant = (overrides: Partial<TenantLocalizationValue> = {}): TenantLocalizationValue => ({
  availableLocales: ['ru', 'en', 'de'],
  defaultLocale: 'ru',
  termOverrides: {},
  ...overrides,
});

const createLoader = (catalog: LocaleCatalogValue): ReturnType<typeof vi.fn<CatalogLoader>> => {
  return vi.fn<CatalogLoader>(() => Promise.resolve(catalog));
};

const createOptions = (overrides: Partial<LocalizerOptionsValue> = {}): LocalizerOptionsValue => ({
  bundledLocales: ['ru', 'en', 'de'],
  catalogLoaders: {
    de: createLoader(deCatalog),
    en: createLoader(enCatalog),
    ru: createLoader(ruCatalog),
  },
  requestedLocale: undefined,
  tenant: createTenant(),
  ...overrides,
});

describe('createLocalizer', () => {
  it('starts with the resolved locale and its catalog', async () => {
    const localizer = await createLocalizer(createOptions({ requestedLocale: 'en' }));
    const snapshot = localizer.getSnapshot();

    expect(snapshot.locale).toBe('en');
    expect(snapshot.t('field.placeholder')).toBe('A living world is coming soon');
  });

  it('loads only the catalog of the active locale', async () => {
    const options = createOptions();
    await createLocalizer(options);

    expect(options.catalogLoaders.ru).toHaveBeenCalledTimes(1);
    expect(options.catalogLoaders.en).not.toHaveBeenCalled();
    expect(options.catalogLoaders.de).not.toHaveBeenCalled();
  });

  it('rejects when the loader of the resolved locale is missing', async () => {
    await expect(createLocalizer(createOptions({ catalogLoaders: {} }))).rejects.toThrow('Catalog loader is missing for locale "ru"');
  });

  it('applies term overrides of the active locale over the catalog', async () => {
    const localizer = await createLocalizer(createOptions({
      tenant: createTenant({
        termOverrides: { ru: { 'field.placeholder': 'Скоро здесь будет склад' } },
      }),
    }));

    expect(localizer.getSnapshot().t('field.placeholder')).toBe('Скоро здесь будет склад');
  });

  it('ignores term overrides of another locale', async () => {
    const localizer = await createLocalizer(createOptions({
      tenant: createTenant({
        termOverrides: { en: { 'field.placeholder': 'Another text' } },
      }),
    }));

    expect(localizer.getSnapshot().t('field.placeholder')).toBe('Здесь скоро появится живой мир');
  });

  it('drops invalid term overrides', async () => {
    const localizer = await createLocalizer(createOptions({
      tenant: createTenant({
        termOverrides: { ru: { 'field.placeholder': { other: 'Не строка' }, 'unknown.key': 'Текст' } },
      }),
    }));
    const { t } = localizer.getSnapshot();

    expect(t('field.placeholder')).toBe('Здесь скоро появится живой мир');
  });

  it('formats numbers, currency and dates by the active locale', async () => {
    const localizer = await createLocalizer(createOptions());
    const snapshot = localizer.getSnapshot();

    expect(snapshot.formatNumber(1234.5)).toMatch(/^1\s234,5$/u);
    expect(snapshot.formatNumber(0.25, { style: 'percent' })).toMatch(/^25\s%$/u);
    expect(snapshot.formatCurrency(1234.5, 'RUB')).toMatch(/^1\s234,50\s₽$/u);
    expect(snapshot.formatDate(new Date(Date.UTC(2026, 9, 7, 12)), { dateStyle: 'long', timeZone: 'UTC' })).toBe('7 октября 2026 г.');
  });

  it('keeps the snapshot stable while nothing changes', async () => {
    const localizer = await createLocalizer(createOptions());

    expect(localizer.getSnapshot()).toBe(localizer.getSnapshot());
  });
});

describe('createLocalizer setLocale', () => {
  it('switches the locale, loads the catalog lazily and notifies subscribers', async () => {
    const options = createOptions();
    const localizer = await createLocalizer(options);
    const listener = vi.fn();
    localizer.subscribe(listener);
    const before = localizer.getSnapshot();

    await localizer.setLocale('en');

    expect(localizer.getSnapshot()).not.toBe(before);
    expect(localizer.getSnapshot().locale).toBe('en');
    expect(localizer.getSnapshot().t('units.pallet', { count: 2 })).toBe('2 pallets');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(options.catalogLoaders.en).toHaveBeenCalledTimes(1);
  });

  it('calls a loader only once across switches', async () => {
    const options = createOptions();
    const localizer = await createLocalizer(options);

    await localizer.setLocale('en');
    await localizer.setLocale('ru');
    await localizer.setLocale('en');

    expect(options.catalogLoaders.en).toHaveBeenCalledTimes(1);
    expect(options.catalogLoaders.ru).toHaveBeenCalledTimes(1);
  });

  it('shares one load between concurrent requests for the same locale', async () => {
    const options = createOptions();
    const localizer = await createLocalizer(options);

    await Promise.all([localizer.setLocale('en'), localizer.setLocale('en')]);

    expect(options.catalogLoaders.en).toHaveBeenCalledTimes(1);
  });

  it('ignores a locale outside the bundle or not allowed for the tenant', async () => {
    const localizer = await createLocalizer(createOptions({
      bundledLocales: ['ru', 'en'],
      tenant: createTenant({ availableLocales: ['ru', 'de'] }),
    }));
    const listener = vi.fn();
    localizer.subscribe(listener);
    const before = localizer.getSnapshot();

    await localizer.setLocale('fr');
    await localizer.setLocale('en');
    await localizer.setLocale('de');

    expect(localizer.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not notify when the locale stays the same', async () => {
    const localizer = await createLocalizer(createOptions());
    const listener = vi.fn();
    localizer.subscribe(listener);

    await localizer.setLocale('ru');

    expect(listener).not.toHaveBeenCalled();
  });

  it('lets the last request win when an earlier one resolves later', async () => {
    const slowEnCatalog = createDeferred<LocaleCatalogValue>();
    const localizer = await createLocalizer(createOptions({
      catalogLoaders: {
        de: createLoader(deCatalog),
        en: () => slowEnCatalog.promise,
        ru: createLoader(ruCatalog),
      },
    }));
    const listener = vi.fn();
    localizer.subscribe(listener);

    const enRequest = localizer.setLocale('en');
    await localizer.setLocale('de');
    slowEnCatalog.resolve(enCatalog);
    await enRequest;

    expect(localizer.getSnapshot().locale).toBe('de');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending switch when the locale is requested back', async () => {
    const slowEnCatalog = createDeferred<LocaleCatalogValue>();
    const localizer = await createLocalizer(createOptions({
      catalogLoaders: {
        en: () => slowEnCatalog.promise,
        ru: createLoader(ruCatalog),
      },
    }));

    const enRequest = localizer.setLocale('en');
    await localizer.setLocale('ru');
    slowEnCatalog.resolve(enCatalog);
    await enRequest;

    expect(localizer.getSnapshot().locale).toBe('ru');
  });

  it('keeps the current state and allows a retry when a loader fails', async () => {
    const failingLoader = vi.fn<CatalogLoader>()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(enCatalog);
    const localizer = await createLocalizer(createOptions({
      catalogLoaders: { en: failingLoader, ru: createLoader(ruCatalog) },
    }));

    await expect(localizer.setLocale('en')).rejects.toThrow('Network error');
    expect(localizer.getSnapshot().locale).toBe('ru');

    await localizer.setLocale('en');

    expect(localizer.getSnapshot().locale).toBe('en');
    expect(failingLoader).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', async () => {
    const localizer = await createLocalizer(createOptions());
    const listener = vi.fn();
    const unsubscribe = localizer.subscribe(listener);

    unsubscribe();
    await localizer.setLocale('en');

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createLocalizer applyTenant', () => {
  it('recalculates term overrides and notifies subscribers', async () => {
    const localizer = await createLocalizer(createOptions());
    const listener = vi.fn();
    localizer.subscribe(listener);

    await localizer.applyTenant(createTenant({
      termOverrides: { ru: { 'field.placeholder': 'Ворота скоро откроются' } },
    }));

    expect(localizer.getSnapshot().t('field.placeholder')).toBe('Ворота скоро откроются');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('recalculates the locale from the new tenant default', async () => {
    const options = createOptions();
    const localizer = await createLocalizer(options);

    await localizer.applyTenant(createTenant({ defaultLocale: 'de' }));

    expect(localizer.getSnapshot().locale).toBe('de');
    expect(options.catalogLoaders.de).toHaveBeenCalledTimes(1);
  });

  it('keeps the explicitly selected locale while the new tenant allows it', async () => {
    const localizer = await createLocalizer(createOptions());
    await localizer.setLocale('en');

    await localizer.applyTenant(createTenant({ defaultLocale: 'de' }));

    expect(localizer.getSnapshot().locale).toBe('en');
  });

  it('falls back when the new tenant no longer allows the selected locale', async () => {
    const localizer = await createLocalizer(createOptions());
    await localizer.setLocale('en');

    await localizer.applyTenant(createTenant({ availableLocales: ['ru'] }));

    expect(localizer.getSnapshot().locale).toBe('ru');
  });

  it('validates setLocale against the latest tenant', async () => {
    const localizer = await createLocalizer(createOptions());

    await localizer.applyTenant(createTenant({ availableLocales: ['ru'] }));
    await localizer.setLocale('en');

    expect(localizer.getSnapshot().locale).toBe('ru');
  });
});
