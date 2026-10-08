import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { Organization } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { AccessService } from '@skladburg/contracts/access/v1/access';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  GetOrganizationResponseSchema,
  GetOrganizationSettingsResponseSchema,
  ListWarehousesResponseSchema,
  OrganizationSchema,
  OrganizationService,
  OrganizationSettingsSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  bundledLocales,
  catalogLoaders,
  defaultLocaleCatalog,
  defaultTenant,
} from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { AppSectionValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import { createQueryClient } from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';
import { createLocalizer } from '@/shared/i18n';
import {
  APP_SECTIONS,
  OBJECT_HOME_SECTION,
  OBJECT_TYPES,
} from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { App } from './App';
import { createSessionFixture } from './lib/testing/sessionFixtures';
import { createTestThemeStore } from './lib/testing/themeFixtures';
import { SECTION_TITLE_KEYS } from './routing/sections';

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

const createSessionError = (): ConnectError => new ConnectError(
  'the session is broken',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.INVALID_TRANSITION }) }],
);

const createSessionFixtureResponse = (): GetSessionResponse => createSessionFixture();

const createOrganization = (): Organization => create(OrganizationSchema, {
  id: TEST_ORGANIZATION_ID,
  legalName: 'ООО «Север-Опт»',
  name: 'Север-Опт',
});

interface RenderAppOptionsValue {
  getSession?: (() => GetSessionResponse | Promise<GetSessionResponse>) | undefined;
}

const renderApp = async (initialPath: string, { getSession }: RenderAppOptionsValue = {}): Promise<IMemoryLocation> => {
  const localizer = await createLocalizer({
    bundledLocales,
    catalogLoaders,
    requestedLocale: undefined,
    tenant: defaultTenant,
    userTimeZone: 'UTC',
  });
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(AccessService, { getSession: getSession ?? createSessionFixtureResponse });
      router.service(OrganizationService, {
        getOrganization: () => create(GetOrganizationResponseSchema, { organization: createOrganization() }),
        getOrganizationSettings: () => create(GetOrganizationSettingsResponseSchema, {
          settings: create(OrganizationSettingsSchema, {
            availableLocales: [defaultTenant.defaultLocale],
            brandName: BRAND_NAME,
            defaultLocale: defaultTenant.defaultLocale,
            organizationId: TEST_ORGANIZATION_ID,
          }),
        }),
        listWarehouses: () => create(ListWarehousesResponseSchema, { warehouses: [] }),
      });
    },
  });
  const location = createMemoryLocation(initialPath);

  render(
    <App
      localizer={localizer}
      location={location}
      queryClient={createQueryClient({ networkMode: 'always' })}
      runtime={runtime}
      themeStore={createTestThemeStore()}
    />,
  );

  return location;
};

const getSectionTitle = (section: AppSectionValue): string => defaultLocaleCatalog[SECTION_TITLE_KEYS[section]];

const getNavigation = (): HTMLElement => screen.getByRole('navigation', { name: defaultLocaleCatalog['app.nav.label'] });

const findSectionHeading = (section: AppSectionValue): Promise<HTMLElement> => {
  return screen.findByRole('heading', { level: 1, name: getSectionTitle(section) });
};

const formatDocumentTitle = (sectionTitle: string): string => {
  return defaultLocaleCatalog['app.documentTitle'].replace('{section}', sectionTitle).replace('{brand}', BRAND_NAME);
};

afterEach(() => {
  cleanup();
});

describe('App routes', () => {
  it.each(APP_SECTIONS)('opens the section %s by its address', async (section) => {
    await renderApp(`/${section}`);

    await findSectionHeading(section);

    expect(screen.getByRole('main')).toBeDefined();
    expect(document.title).toBe(formatDocumentTitle(getSectionTitle(section)));
  });

  it.each(['network', 'catalog', 'deals'] as const)('shows the placeholder of the section %s without an object', async (section) => {
    await renderApp(`/${section}`);
    await findSectionHeading(section);

    expect(screen.getByText(defaultLocaleCatalog[`section.${section}.placeholder`])).toBeDefined();
    expect(screen.queryByText(new RegExp(defaultLocaleCatalog['routing.focusedObject'].replace(' {type}', '')))).toBeNull();
  });

  it.each(OBJECT_TYPES)('opens the object of the type %s in its home section and names it', async (type) => {
    const section = OBJECT_HOME_SECTION[type];
    const typeTitle = defaultLocaleCatalog[`object.type.${type}`];

    await renderApp(`/${OBJECT_SEGMENTS[type]}/${OBJECT_ID}`);
    await findSectionHeading(section);

    const identifier = screen.getByText(OBJECT_ID);
    const note = identifier.closest('p');

    expect(identifier.getAttribute('translate')).toBe('no');
    expect(note?.textContent).toBe(`${defaultLocaleCatalog['routing.focusedObject'].replace('{type}', typeTitle)} ${OBJECT_ID}`);
    expect(document.title).toBe(formatDocumentTitle(getSectionTitle(section)));
    expect(within(getNavigation()).getByRole('link', { name: getSectionTitle(section) }).getAttribute('aria-current')).toBe('page');
  });

  it('keeps the address until the settings are applied and then opens the first section instead of the empty address', async () => {
    const location = await renderApp('/');

    expect(screen.getByRole('main', { busy: true })).toBeDefined();
    expect(location.history).toEqual(['/']);

    await findSectionHeading('network');

    expect(location.history).toEqual(['/network']);
    expect(document.title).toBe(formatDocumentTitle(getSectionTitle('network')));
  });

  it('shows the not found screen for an unknown address and leads to the first section by its link', async () => {
    const location = await renderApp('/nope');

    await screen.findByRole('heading', { level: 1, name: defaultLocaleCatalog['routing.notFound.title'] });

    expect(document.title).toBe(formatDocumentTitle(defaultLocaleCatalog['routing.notFound.title']));

    fireEvent.click(screen.getByRole('link', {
      name: defaultLocaleCatalog['routing.notFound.action'].replace('{section}', getSectionTitle('network')),
    }));

    await findSectionHeading('network');

    expect(location.history).toEqual(['/nope', '/network']);
  });

  it('moves between the sections by the navigation, back and forward', async () => {
    const location = await renderApp('/network');
    await findSectionHeading('network');

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('catalog') }));
    await findSectionHeading('catalog');

    expect(document.title).toBe(formatDocumentTitle(getSectionTitle('catalog')));
    expect(within(getNavigation()).getByRole('link', { name: getSectionTitle('catalog') }).getAttribute('aria-current')).toBe('page');
    expect(within(getNavigation()).getByRole('link', { name: getSectionTitle('network') }).getAttribute('aria-current')).toBeNull();

    act(() => {
      location.back();
    });
    await findSectionHeading('network');

    act(() => {
      location.forward();
    });
    await findSectionHeading('catalog');
  });

  it('moves the focus to the main landmark after the navigation but not after the first show', async () => {
    await renderApp('/network');
    await findSectionHeading('network');

    expect(document.activeElement).not.toBe(screen.getByRole('main'));

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('deals') }));
    await findSectionHeading('deals');

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('main'));
    });
  });

  it('shows the navigation of the profile of the organization and replaces a section that is not available', async () => {
    const location = await renderApp('/warehouse', { getSession: () => createSessionFixture({ profiles: [ProfileKind.CARRIER] }) });

    await findSectionHeading('network');

    expect(location.history).toEqual(['/network']);
    expect(within(getNavigation()).getAllByRole('link').map(link => link.textContent)).toEqual([
      getSectionTitle('network'),
      getSectionTitle('deals'),
    ]);
  });

  it('shows the screen without access for an object whose home section is not available', async () => {
    await renderApp(`/warehouses/${OBJECT_ID}`, { getSession: () => createSessionFixture({ profiles: [ProfileKind.CARRIER] }) });

    await screen.findByRole('heading', { level: 1, name: defaultLocaleCatalog['routing.objectUnavailable.title'] });

    expect(screen.getByRole('link', {
      name: defaultLocaleCatalog['routing.objectUnavailable.action'].replace('{section}', getSectionTitle('network')),
    }).getAttribute('href')).toBe('#/network');
  });

  it('shows the text about missing sections for an organization without profiles', async () => {
    const location = await renderApp('/', { getSession: () => createSessionFixture({ profiles: [] }) });

    expect(await screen.findByRole('heading', { level: 1, name: defaultLocaleCatalog['session.noSections'] })).toBeDefined();
    expect(location.history).toEqual(['/']);
    expect(within(getNavigation()).queryAllByRole('link')).toEqual([]);
  });

  it('shows the message by the code of the session error and loads the session again on retry', async () => {
    let attempt = 0;
    await renderApp('/network', {
      getSession: () => {
        attempt += 1;

        if (attempt === 1) {
          throw createSessionError();
        }

        return createSessionFixture();
      },
    });

    expect((await screen.findByRole('alert')).textContent).toBe(defaultLocaleCatalog['error.invalid_transition']);

    fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    await findSectionHeading('network');
    expect(attempt).toBe(2);
  });

  it('keeps the error screen with a busy retry button while the session loads again', async () => {
    let attempt = 0;
    let finishReload: () => void = () => undefined;
    const reload = new Promise<void>((resolve) => {
      finishReload = resolve;
    });
    await renderApp('/network', {
      getSession: async () => {
        attempt += 1;

        if (attempt === 1) {
          throw createSessionError();
        }

        await reload;

        return createSessionFixture();
      },
    });
    const alert = await screen.findByRole('alert');
    const retryButton = screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] });

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(retryButton.getAttribute('aria-busy')).toBe('true');
    });
    expect(retryButton.getAttribute('aria-disabled')).toBe('true');
    expect(retryButton.textContent).toBe(defaultLocaleCatalog['common.retrying']);
    expect(screen.getByRole('alert')).toBe(alert);
    expect(screen.getByRole('button', { name: defaultLocaleCatalog['common.retrying'] })).toBe(retryButton);

    fireEvent.click(retryButton);
    finishReload();

    await findSectionHeading('network');
    expect(attempt).toBe(2);
  });
});
