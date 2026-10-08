import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type {
  ILocalizer,
  LocaleCatalogValue,
} from '@/shared/i18n';
import type { IMemoryLocation } from '@/shared/routing/index.testing';
import type { TenantSettingsValue } from '@/shared/tenant';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';
import { TenantSettingsProvider } from '@/shared/tenant';

import { useDocumentSync } from './useDocumentSync';

const catalog: LocaleCatalogValue = {
  ...defaultLocaleCatalog,
  'warehouse.placeholder': 'Скоро здесь будет склад',
};

const enCatalog: LocaleCatalogValue = {
  ...defaultLocaleCatalog,
  'app.startError.message': 'The application failed to start',
  'common.retry': 'Retry',
  'common.retrying': 'Retrying…',
  'section.warehouse.title': 'Warehouse',
  'units.pallet': { one: '{count} pallet', other: '{count} pallets' },
  'warehouse.placeholder': 'A warehouse is coming soon',
};

const tenantSettings: TenantSettingsValue = {
  availableLocales: ['ru', 'en'],
  brandName: 'Северный склад',
  defaultLocale: 'ru',
  tenantId: 'f2000001-0000-4000-8000-000000000000',
  termOverrides: {},
};

const createTestLocalizer = (): Promise<ILocalizer> => {
  return createLocalizer({
    bundledLocales: ['ru', 'en'],
    catalogLoaders: { en: () => Promise.resolve(enCatalog), ru: () => Promise.resolve(catalog) },
    requestedLocale: undefined,
    tenant: tenantSettings,
    userTimeZone: 'UTC',
  });
};

const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';

const formatTitle = (catalogValue: LocaleCatalogValue, sectionTitle: string): string => {
  return catalogValue['app.documentTitle'].replace('{section}', sectionTitle).replace('{brand}', tenantSettings.brandName);
};

const createWrapper = (localizer: ILocalizer, settings: TenantSettingsValue, location: IMemoryLocation) => {
  return ({ children }: { children: ReactNode }): ReactElement => (
    <RoutingProvider location={location}>
      <LocalizerProvider localizer={localizer}>
        <TenantSettingsProvider tenantSettings={settings}>{children}</TenantSettingsProvider>
      </LocalizerProvider>
    </RoutingProvider>
  );
};

describe('useDocumentSync', () => {
  beforeEach(() => {
    document.title = '';
    document.documentElement.lang = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('sets the document language and the title from the section and the brand', async () => {
    const localizer = await createTestLocalizer();
    const location = createMemoryLocation('/warehouse');

    renderHook(useDocumentSync, { wrapper: createWrapper(localizer, tenantSettings, location) });

    expect(document.documentElement.lang).toBe('ru');
    expect(document.title).toBe(formatTitle(catalog, catalog['section.warehouse.title']));
  });

  it.each([
    { path: '/network', title: 'section.network.title' },
    { path: '/catalog', title: 'section.catalog.title' },
    { path: '/deals', title: 'section.deals.title' },
    { path: `/deals/${OBJECT_ID}`, title: 'section.deals.title' },
    { path: `/documents/${OBJECT_ID}`, title: 'section.deals.title' },
    { path: `/dashboards/${OBJECT_ID}`, title: 'section.network.title' },
    { path: `/cells/${OBJECT_ID}`, title: 'section.warehouse.title' },
  ] as const)('titles $path with the section of its home', async ({ path, title }) => {
    const localizer = await createTestLocalizer();

    renderHook(useDocumentSync, { wrapper: createWrapper(localizer, tenantSettings, createMemoryLocation(path)) });

    expect(document.title).toBe(formatTitle(catalog, catalog[title]));
  });

  it('titles an unknown address as not found', async () => {
    const localizer = await createTestLocalizer();

    renderHook(useDocumentSync, { wrapper: createWrapper(localizer, tenantSettings, createMemoryLocation('/nope')) });

    expect(document.title).toBe(formatTitle(catalog, catalog['routing.notFound.title']));
  });

  it('uses the bare brand while the empty address waits for its redirect', async () => {
    const localizer = await createTestLocalizer();

    renderHook(useDocumentSync, { wrapper: createWrapper(localizer, tenantSettings, createMemoryLocation('/')) });

    expect(document.title).toBe(tenantSettings.brandName);
  });

  it('follows the navigation', async () => {
    const localizer = await createTestLocalizer();
    const location = createMemoryLocation('/network');

    renderHook(useDocumentSync, { wrapper: createWrapper(localizer, tenantSettings, location) });
    act(() => {
      location.navigate('/catalog');
    });

    expect(document.title).toBe(formatTitle(catalog, catalog['section.catalog.title']));

    act(() => {
      location.back();
    });

    expect(document.title).toBe(formatTitle(catalog, catalog['section.network.title']));
  });

  it('follows the active locale', async () => {
    const localizer = await createTestLocalizer();
    const location = createMemoryLocation('/warehouse');

    renderHook(useDocumentSync, { wrapper: createWrapper(localizer, tenantSettings, location) });
    await act(() => localizer.setLocale('en'));

    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe(formatTitle(enCatalog, enCatalog['section.warehouse.title']));
  });
});
