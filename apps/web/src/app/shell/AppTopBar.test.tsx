import type { ReactElement } from 'react';

import { AccessService } from '@skladburg/contracts/access/v1/access';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  DemoPersonaListItemValue,
  IDemoControl,
} from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';
import type { ViewportClassValue } from '@/shared/lib/viewport';
import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { AppSectionValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import {
  DemoPersonaGroup,
  DemoPersonaKind,
} from '@/shared/api';
import {
  APP_SECTIONS,
  OBJECT_HOME_SECTION,
  OBJECT_TYPES,
  SECTION_TITLE_KEYS,
} from '@/shared/routing';

import type { AvailableSectionsValue } from '../access';

import {
  createSessionFixture,
  SESSION_ORGANIZATION_ID,
  SESSION_ORGANIZATION_NAME,
  SESSION_USER_DISPLAY_NAME,
  SESSION_USER_ID,
} from '../lib/testing/sessionFixtures';
import { createTestThemeStore } from '../lib/testing/themeFixtures';

interface ProfileMenuLoaderModuleValue {
  loadProfileMenu: () => Promise<unknown>;
}

const PROFILE_MENU_LOADER_PATH = '@/widgets/profile-menu/ui/loadProfileMenu';

const { loadProfileMenuMock } = vi.hoisted(() => ({ loadProfileMenuMock: vi.fn<() => Promise<unknown>>() }));

vi.mock('@/widgets/profile-menu/ui/loadProfileMenu', () => ({ loadProfileMenu: loadProfileMenuMock }));

const BRAND_NAME = 'Северный склад';
const PRODUCT_NAME = defaultLocaleCatalog['app.productName'];
const ALL_SECTIONS_VALUE: AvailableSectionsValue = { kind: 'ready', landingSection: 'network', sections: APP_SECTIONS };
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
const READY_BUTTON_NAME = defaultLocaleCatalog['profile.button.label']
  .replace('{name}', SESSION_USER_DISPLAY_NAME)
  .replace('{organization}', SESSION_ORGANIZATION_NAME);
const LOADING_BUTTON_NAME = defaultLocaleCatalog['profile.button.loading'];
const SIGN_IN_LINE = /Войти как/;

const FIRST_PERSONA: DemoPersonaListItemValue = {
  group: DemoPersonaGroup.FRESH,
  id: 'f9000001-0000-4000-8000-000000000000',
  kind: DemoPersonaKind.CUSTOMER,
  organizationId: SESSION_ORGANIZATION_ID,
  organizationName: SESSION_ORGANIZATION_NAME,
  roleName: 'Администратор',
  userDisplayName: SESSION_USER_DISPLAY_NAME,
  userId: SESSION_USER_ID,
};

interface GateValue {
  open: () => void;
  promise: Promise<void>;
}

interface RenderAppTopBarOptionsValue {
  availableSections?: AvailableSectionsValue;
  demoControl?: IDemoControl;
  sessionGate?: GateValue;
  viewportClass?: ViewportClassValue;
}

interface RenderedAppTopBarValue {
  loadProfileMenu: typeof loadProfileMenuMock;
  location: IMemoryLocation;
  remountAppTopBar: () => void;
}

let installedViewport: IFakeViewport | undefined;

const createGate = (): GateValue => {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { open, promise };
};

const createDemoControl = (): IDemoControl => ({
  listPersonas: () => Promise.resolve([FIRST_PERSONA]),
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset: () => Promise.resolve(),
});

const renderAppTopBar = async (
  initialPath: string,
  { availableSections = ALL_SECTIONS_VALUE, demoControl, sessionGate, viewportClass = 'desktop' }: RenderAppTopBarOptionsValue = {},
): Promise<RenderedAppTopBarValue> => {
  vi.resetModules();
  installedViewport?.restore();

  const [
    { installFakeViewport },
    { ApiRuntimeProvider },
    { createTestRuntime },
    { createLocalizer, LocalizerProvider },
    { RoutingProvider },
    { createMemoryLocation },
    { TenantSettingsProvider },
    { ThemePreferenceProvider },
    { FocusHandoffProvider, LiveRegionProvider },
    { AvailableSectionsProvider },
    { AppTopBar },
  ] = await Promise.all([
    import('@/shared/lib/viewport/index.testing'),
    import('@/shared/api'),
    import('@/shared/api/index.testing'),
    import('@/shared/i18n'),
    import('@/shared/routing'),
    import('@/shared/routing/index.testing'),
    import('@/shared/tenant'),
    import('@/shared/theme'),
    import('@/shared/ui'),
    import('../access'),
    import('./AppTopBar'),
  ]);

  const actualModule = await vi.importActual<ProfileMenuLoaderModuleValue>(PROFILE_MENU_LOADER_PATH);

  loadProfileMenuMock.mockReset();
  loadProfileMenuMock.mockImplementation(actualModule.loadProfileMenu);

  installedViewport = installFakeViewport(viewportClass);

  const localizer: ILocalizer = await createLocalizer({
    bundledLocales: ['ru'],
    catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
    userTimeZone: 'UTC',
  });
  const location = createMemoryLocation(initialPath);
  const runtime = createTestRuntime({
    demoControl,
    routes: (router) => {
      router.service(AccessService, {
        getSession: async () => {
          await sessionGate?.promise;

          return createSessionFixture();
        },
      });
    },
  });
  runtime.actingContext.set({ organizationId: SESSION_ORGANIZATION_ID, userId: SESSION_USER_ID });

  const queryClient = new QueryClient({ defaultOptions: { queries: { networkMode: 'always', retry: false } } });
  const tenantSettings = {
    availableLocales: ['ru'],
    brandName: BRAND_NAME,
    defaultLocale: 'ru',
    tenantId: 'f2000001-0000-4000-8000-000000000000',
    termOverrides: {},
  };
  const themeStore = createTestThemeStore();
  const createTree = (appTopBarKey: number): ReactElement => (
    <ThemePreferenceProvider store={themeStore}>
      <RoutingProvider location={location}>
        <LocalizerProvider localizer={localizer}>
          <ApiRuntimeProvider runtime={runtime}>
            <QueryClientProvider client={queryClient}>
              <LiveRegionProvider>
                <FocusHandoffProvider>
                  <TenantSettingsProvider tenantSettings={tenantSettings}>
                    <AvailableSectionsProvider value={availableSections}>
                      <AppTopBar key={appTopBarKey} />
                    </AvailableSectionsProvider>
                  </TenantSettingsProvider>
                </FocusHandoffProvider>
              </LiveRegionProvider>
            </QueryClientProvider>
          </ApiRuntimeProvider>
        </LocalizerProvider>
      </RoutingProvider>
    </ThemePreferenceProvider>
  );

  let appTopBarKey = 0;
  const { rerender } = render(createTree(appTopBarKey));

  const remountAppTopBar = (): void => {
    appTopBarKey += 1;
    rerender(createTree(appTopBarKey));
  };

  return { loadProfileMenu: loadProfileMenuMock, location, remountAppTopBar };
};

const getSectionTitle = (section: AppSectionValue): string => defaultLocaleCatalog[SECTION_TITLE_KEYS[section]];

const getNavigation = (): HTMLElement => screen.getByRole('navigation', { name: defaultLocaleCatalog['app.nav.label'] });

const getCurrentSections = (): AppSectionValue[] => {
  return APP_SECTIONS.filter((section) => {
    return within(getNavigation()).getByRole('link', { name: getSectionTitle(section) }).getAttribute('aria-current') === 'page';
  });
};

const findProfileButton = (): Promise<HTMLElement> => screen.findByRole('button', { name: READY_BUTTON_NAME });

const queryProfileButtons = (): HTMLElement[] => within(screen.getByRole('banner')).queryAllByRole('button', { name: /^Профиль/ });

describe('AppTopBar', () => {
  afterEach(() => {
    cleanup();
    installedViewport?.restore();
    installedViewport = undefined;
  });

  it('shows the product name without translation and not the brand of the organization', async () => {
    await renderAppTopBar('/network');

    const name = within(screen.getByRole('banner')).getByText(PRODUCT_NAME);

    expect(name.getAttribute('translate')).toBe('no');
    expect(screen.queryByText(BRAND_NAME)).toBeNull();
  });

  it('has a labelled navigation with a link to every section in order', async () => {
    await renderAppTopBar('/network');

    const links = within(getNavigation()).getAllByRole('link');

    expect(links.map(link => link.textContent)).toEqual(APP_SECTIONS.map(getSectionTitle));
    expect(links.map(link => link.getAttribute('href'))).toEqual(APP_SECTIONS.map(section => `#/${section}`));
  });

  it.each(APP_SECTIONS)('marks only the section %s as the current page', async (section) => {
    await renderAppTopBar(`/${section}`);

    expect(getCurrentSections()).toEqual([section]);
  });

  it.each(OBJECT_TYPES)('marks the home section of the object type %s as the current page', async (type) => {
    await renderAppTopBar(`/${OBJECT_SEGMENTS[type]}/${OBJECT_ID}`);

    expect(getCurrentSections()).toEqual([OBJECT_HOME_SECTION[type]]);
  });

  it.each(['/', '/nope'])('marks no section for the address %s', async (path) => {
    await renderAppTopBar(path);

    expect(getCurrentSections()).toEqual([]);
  });

  it('opens the section by the link and moves the current mark', async () => {
    const { location } = await renderAppTopBar('/network');

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('deals') }));

    expect(location.history).toEqual(['/network', '/deals']);
    expect(getCurrentSections()).toEqual(['deals']);
  });

  it('follows the history', async () => {
    const { location } = await renderAppTopBar('/network');
    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('catalog') }));

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('warehouse') }));
    act(() => {
      location.back();
    });

    expect(getCurrentSections()).toEqual(['catalog']);
  });

  it('leaves the modified click to the browser', async () => {
    const { location } = await renderAppTopBar('/network');

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('deals') }), { ctrlKey: true });

    expect(location.history).toEqual(['/network']);
    expect(getCurrentSections()).toEqual(['network']);
  });

  it('shows only the sections that are available, in the order of sections', async () => {
    const sections: AppSectionValue[] = ['network', 'deals', 'warehouse'];
    await renderAppTopBar('/warehouse', { availableSections: { kind: 'ready', landingSection: 'network', sections } });

    const links = within(getNavigation()).getAllByRole('link');

    expect(links.map(link => link.textContent)).toEqual(sections.map(getSectionTitle));
    expect(within(getNavigation()).queryByRole('link', { name: getSectionTitle('catalog') })).toBeNull();
  });

  it('shows the single section of a persona that has one', async () => {
    await renderAppTopBar('/warehouse', {
      availableSections: { kind: 'ready', landingSection: 'warehouse', sections: ['warehouse'] },
    });

    expect(within(getNavigation()).getAllByRole('link').map(link => link.textContent)).toEqual([getSectionTitle('warehouse')]);
  });

  const UNREADY_VALUES: AvailableSectionsValue[] = [
    { kind: 'loading' },
    { kind: 'empty' },
    { error: new Error('the session is unavailable'), isRetrying: false, kind: 'error', onRetry: () => undefined },
  ];

  it.each(UNREADY_VALUES)('keeps the profile button and no links while the sections are $kind', async (availableSections) => {
    await renderAppTopBar('/network', { availableSections });

    expect(screen.getByText(PRODUCT_NAME)).toBeDefined();
    expect(within(getNavigation()).queryAllByRole('link')).toEqual([]);
    expect(await findProfileButton()).toBeDefined();
  });

  describe('profile button', () => {
    it('is the last control of the banner, a collapsed menu button named with the user and the organization', async () => {
      await renderAppTopBar('/network');

      const button = await findProfileButton();
      const banner = screen.getByRole('banner');
      const controls = within(banner).getAllByRole('button', { hidden: true });

      expect(button.getAttribute('aria-haspopup')).toBe('menu');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(controls.at(-1)).toBe(button);
      expect(queryProfileButtons()).toHaveLength(1);
    });

    it('has a focusable button named by the loading label while the session loads, then takes the real name', async () => {
      const gate = createGate();
      await renderAppTopBar('/network', { sessionGate: gate });

      const loadingButton = screen.getByRole('button', { name: LOADING_BUTTON_NAME });

      expect(loadingButton.hasAttribute('disabled')).toBe(false);
      expect(loadingButton.getAttribute('aria-disabled')).toBeNull();

      gate.open();

      const readyButton = await findProfileButton();

      expect(readyButton).toBe(loadingButton);
    });

    it.each(['desktop', 'tablet', 'phone'] as const)('is the only control of the person on a %s', async (viewportClass) => {
      await renderAppTopBar('/network', { demoControl: createDemoControl(), viewportClass });
      await findProfileButton();

      const banner = screen.getByRole('banner');

      expect(within(banner).queryByText(SIGN_IN_LINE)).toBeNull();
      expect(within(banner).queryByRole('button', { name: SIGN_IN_LINE })).toBeNull();
      expect(within(banner).queryByRole('group', { name: defaultLocaleCatalog['theme.label'] })).toBeNull();
      expect(within(banner).queryByRole('button', { name: defaultLocaleCatalog['demo.reset.label'] })).toBeNull();
    });

    it('is the same outside the demo', async () => {
      await renderAppTopBar('/network');

      expect(await findProfileButton()).toBeDefined();
      expect(within(screen.getByRole('banner')).queryByRole('button', { name: SIGN_IN_LINE })).toBeNull();
    });

    it('keeps its place when the top bar is mounted again for another acting context', async () => {
      const { remountAppTopBar } = await renderAppTopBar('/network', { demoControl: createDemoControl() });
      const button = await findProfileButton();

      act(() => {
        remountAppTopBar();
      });

      const nextButton = await findProfileButton();

      expect(nextButton).not.toBe(button);
      expect(queryProfileButtons()).toHaveLength(1);
    });
  });

  describe('lazy menu', () => {
    it('does not load the chunk of the menu at the start in the demo and outside it', async () => {
      const demo = await renderAppTopBar('/network', { demoControl: createDemoControl() });
      await findProfileButton();

      expect(demo.loadProfileMenu).not.toHaveBeenCalled();

      cleanup();
      const plain = await renderAppTopBar('/network');
      await findProfileButton();

      expect(plain.loadProfileMenu).not.toHaveBeenCalled();
    });

    it('warms the chunk up once on hover and opens the menu by the first press', async () => {
      const { loadProfileMenu } = await renderAppTopBar('/network');
      const button = await findProfileButton();

      fireEvent.pointerEnter(button);
      fireEvent.focus(button);

      await waitFor(() => {
        expect(loadProfileMenu).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole('menu')).toBeNull();

      fireEvent.click(button);

      expect(await screen.findByRole('menu', { name: defaultLocaleCatalog['profile.menu.label'] })).toBeDefined();
      expect(loadProfileMenu).toHaveBeenCalledTimes(1);
    });
  });

  describe('menu of the profile', () => {
    it('shows the name and the organization of the session in the header of the menu', async () => {
      await renderAppTopBar('/network');

      fireEvent.click(await findProfileButton());

      const menu = await screen.findByRole('menu', { name: defaultLocaleCatalog['profile.menu.label'] });

      expect(within(menu).getByTestId('profile-menu-name').textContent).toBe(SESSION_USER_DISPLAY_NAME);
      expect(within(menu).getByTestId('profile-menu-role').textContent).toBe(SESSION_ORGANIZATION_NAME);
    });

    it('passes the sections and the current one to the menu on a phone, where the navigation row is hidden', async () => {
      await renderAppTopBar('/deals', { viewportClass: 'phone' });

      fireEvent.click(await findProfileButton());

      const menu = await screen.findByRole('menu', { name: defaultLocaleCatalog['profile.menu.label'] });
      const items = within(menu).getAllByRole('menuitemradio');
      const sectionItems = items.filter(item => APP_SECTIONS.some(section => item.textContent === getSectionTitle(section)));

      expect(sectionItems.map(item => item.textContent)).toEqual(APP_SECTIONS.map(getSectionTitle));
      expect(sectionItems.filter(item => item.getAttribute('aria-checked') === 'true').map(item => item.textContent))
        .toEqual([getSectionTitle('deals')]);
    });

    it('has no group of sections in the menu on a desktop', async () => {
      await renderAppTopBar('/deals', { viewportClass: 'desktop' });

      fireEvent.click(await findProfileButton());

      const menu = await screen.findByRole('menu', { name: defaultLocaleCatalog['profile.menu.label'] });

      expect(within(menu).queryByRole('menuitemradio', { name: getSectionTitle('deals') })).toBeNull();
    });

    it('lists only the available sections in the menu on a phone', async () => {
      const sections: AppSectionValue[] = ['network', 'deals'];
      await renderAppTopBar('/deals', {
        availableSections: { kind: 'ready', landingSection: 'network', sections },
        viewportClass: 'phone',
      });

      fireEvent.click(await findProfileButton());

      const menu = await screen.findByRole('menu', { name: defaultLocaleCatalog['profile.menu.label'] });

      expect(within(menu).queryByRole('menuitemradio', { name: getSectionTitle('catalog') })).toBeNull();
      expect(within(menu).getByRole('menuitemradio', { name: getSectionTitle('deals') })).toBeDefined();
    });
  });
});
