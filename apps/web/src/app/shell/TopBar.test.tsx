import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ILocalizer } from '@/shared/i18n';
import type { AppSectionValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import {
  APP_SECTIONS,
  OBJECT_HOME_SECTION,
  OBJECT_TYPES,
  RoutingProvider,
} from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';
import { TenantSettingsProvider } from '@/shared/tenant';

import { SECTION_TITLE_KEYS } from '../routing/sections';
import { TopBar } from './TopBar';

const BRAND_NAME = 'Северный склад';
const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';
const OBJECT_SEGMENTS = {
  cell: 'cells',
  dashboard: 'dashboards',
  deal: 'deals',
  document: 'documents',
  handling_unit: 'handling-units',
  trip: 'trips',
  vehicle: 'vehicles',
  warehouse: 'warehouses',
} as const;

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const renderTopBar = async (initialPath: string): Promise<IMemoryLocation> => {
  const localizer = await createTestLocalizer();
  const location = createMemoryLocation(initialPath);

  render(
    <RoutingProvider location={location}>
      <LocalizerProvider localizer={localizer}>
        <TenantSettingsProvider
          tenantSettings={{
            availableLocales: ['ru'],
            brandName: BRAND_NAME,
            defaultLocale: 'ru',
            tenantId: 'f2000001-0000-4000-8000-000000000000',
            termOverrides: {},
          }}
        >
          <TopBar />
        </TenantSettingsProvider>
      </LocalizerProvider>
    </RoutingProvider>,
  );

  return location;
};

const getSectionTitle = (section: AppSectionValue): string => defaultLocaleCatalog[SECTION_TITLE_KEYS[section]];

const getNavigation = (): HTMLElement => screen.getByRole('navigation', { name: defaultLocaleCatalog['app.nav.label'] });

const getCurrentSections = (): AppSectionValue[] => {
  return APP_SECTIONS.filter((section) => {
    return within(getNavigation()).getByRole('link', { name: getSectionTitle(section) }).getAttribute('aria-current') === 'page';
  });
};

describe('TopBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the brand of the organization without translation', async () => {
    await renderTopBar('/network');

    const brand = screen.getByText(BRAND_NAME);

    expect(brand.getAttribute('translate')).toBe('no');
  });

  it('has a labelled navigation with a link to every section in order', async () => {
    await renderTopBar('/network');

    const links = within(getNavigation()).getAllByRole('link');

    expect(links.map(link => link.textContent)).toEqual(APP_SECTIONS.map(getSectionTitle));
    expect(links.map(link => link.getAttribute('href'))).toEqual(APP_SECTIONS.map(section => `#/${section}`));
  });

  it.each(APP_SECTIONS)('marks only the section %s as the current page', async (section) => {
    await renderTopBar(`/${section}`);

    expect(getCurrentSections()).toEqual([section]);
  });

  it.each(OBJECT_TYPES)('marks the home section of the object type %s as the current page', async (type) => {
    await renderTopBar(`/${OBJECT_SEGMENTS[type]}/${OBJECT_ID}`);

    expect(getCurrentSections()).toEqual([OBJECT_HOME_SECTION[type]]);
  });

  it.each(['/', '/nope'])('marks no section for the address %s', async (path) => {
    await renderTopBar(path);

    expect(getCurrentSections()).toEqual([]);
  });

  it('opens the section by the link and moves the current mark', async () => {
    const location = await renderTopBar('/network');

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('deals') }));

    expect(location.history).toEqual(['/network', '/deals']);
    expect(getCurrentSections()).toEqual(['deals']);
  });

  it('follows the history', async () => {
    const location = await renderTopBar('/network');
    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('catalog') }));

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('warehouse') }));
    act(() => {
      location.back();
    });

    expect(getCurrentSections()).toEqual(['catalog']);
  });

  it('leaves the modified click to the browser', async () => {
    const location = await renderTopBar('/network');

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('deals') }), { ctrlKey: true });

    expect(location.history).toEqual(['/network']);
    expect(getCurrentSections()).toEqual(['network']);
  });
});
