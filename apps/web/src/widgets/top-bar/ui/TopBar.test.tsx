import type { ReactElement } from 'react';

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
import type {
  AppSectionValue,
  NavigateFunction,
} from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';
import type { IThemePreferenceStore } from '@/shared/theme';

import { DemoPersonaKind } from '@/shared/api';
import {
  APP_SECTIONS,
  SECTION_TITLE_KEYS,
} from '@/shared/routing';

type LoadPhoneMenuType = typeof import('./loadPhoneMenu').loadPhoneMenu;

vi.mock('./loadPhoneMenu', () => ({ loadPhoneMenu: vi.fn() }));

const BRAND_NAME = 'Северный склад';
const MENU_NAME = defaultLocaleCatalog['menu.open'];
const RESET_ITEM_NAME = defaultLocaleCatalog['menu.resetDemo'];
const PERSONA_NODE_TEST_ID = 'persona-node';
const PERSONA_NODE_TEXT = 'persona';

const FIRST_PERSONA: DemoPersonaListItemValue = {
  id: 'f9000001-0000-4000-8000-000000000000',
  kind: DemoPersonaKind.BUYER,
  organizationId: 'f0000001-0000-4000-8000-000000000000',
  organizationName: 'Север-Опт',
  userId: 'f0000002-0000-4000-8000-000000000000',
};

interface GateValue {
  open: () => void;
  promise: Promise<void>;
}

interface RenderedTopBarValue {
  demoControl: IDemoControl;
  loadPhoneMenu: LoadPhoneMenuType;
  location: IMemoryLocation;
  navigate: NavigateFunction | undefined;
  themeStore: IThemePreferenceStore;
}

interface RenderTopBarOptionsValue {
  currentSection?: 'none' | AppSectionValue;
  hasDemo?: boolean;
  menuGate?: GateValue;
  personaSwitcher?: ReactElement | undefined;
  rejectedLoadCount?: number;
  sections?: readonly AppSectionValue[];
}

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
  reset: vi.fn(() => Promise.resolve()),
});

const renderTopBar = async ({
  currentSection = 'network',
  hasDemo = false,
  menuGate,
  personaSwitcher,
  rejectedLoadCount = 0,
  sections = APP_SECTIONS,
}: RenderTopBarOptionsValue = {}): Promise<RenderedTopBarValue> => {
  vi.resetModules();

  const [
    { ApiRuntimeProvider },
    { createTestRuntime },
    { createLocalizer, LocalizerProvider },
    { RoutingProvider },
    { createMemoryLocation },
    { TenantSettingsProvider },
    { createThemePreferenceStore, ThemePreferenceProvider },
    { FocusHandoffProvider, LiveRegionProvider },
    { loadPhoneMenu: mockedLoadPhoneMenu },
    { TopBar },
  ] = await Promise.all([
    import('@/shared/api'),
    import('@/shared/api/index.testing'),
    import('@/shared/i18n'),
    import('@/shared/routing'),
    import('@/shared/routing/index.testing'),
    import('@/shared/tenant'),
    import('@/shared/theme'),
    import('@/shared/ui'),
    import('./loadPhoneMenu'),
    import('./TopBar'),
  ]);

  const actualModule = await vi.importActual<typeof import('./loadPhoneMenu')>('./loadPhoneMenu');
  const loadActualPhoneMenu: LoadPhoneMenuType = menuGate === undefined
    ? actualModule.loadPhoneMenu
    : () => menuGate.promise.then(actualModule.loadPhoneMenu);

  let rejectedCount = 0;
  const loadWithRejections: LoadPhoneMenuType = () => {
    if (rejectedCount < rejectedLoadCount) {
      rejectedCount += 1;

      return Promise.reject(new Error('the menu chunk is unavailable'));
    }

    return loadActualPhoneMenu();
  };

  vi.mocked(mockedLoadPhoneMenu).mockReset();
  vi.mocked(mockedLoadPhoneMenu).mockImplementation(loadWithRejections);

  const localizer: ILocalizer = await createLocalizer({
    bundledLocales: ['ru'],
    catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
    userTimeZone: 'UTC',
  });
  const shownSection = currentSection === 'none' ? undefined : currentSection;
  const location = createMemoryLocation(currentSection === 'none' ? '/' : `/${currentSection}`);
  const demoControl = createDemoControl();
  const runtime = createTestRuntime({ demoControl: hasDemo ? demoControl : undefined });
  runtime.actingContext.set({ organizationId: FIRST_PERSONA.organizationId, userId: FIRST_PERSONA.userId });
  const themeStore = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
  const tenantSettings = {
    availableLocales: ['ru'],
    brandName: BRAND_NAME,
    defaultLocale: 'ru',
    tenantId: 'f2000001-0000-4000-8000-000000000000',
    termOverrides: {},
  };

  render(
    <ThemePreferenceProvider store={themeStore}>
      <RoutingProvider location={location}>
        <LocalizerProvider localizer={localizer}>
          <ApiRuntimeProvider runtime={runtime}>
            <QueryClientProvider client={new QueryClient()}>
              <LiveRegionProvider>
                <FocusHandoffProvider>
                  <TenantSettingsProvider tenantSettings={tenantSettings}>
                    <TopBar currentSection={shownSection} personaSwitcher={personaSwitcher} sections={sections} />
                  </TenantSettingsProvider>
                </FocusHandoffProvider>
              </LiveRegionProvider>
            </QueryClientProvider>
          </ApiRuntimeProvider>
        </LocalizerProvider>
      </RoutingProvider>
    </ThemePreferenceProvider>,
  );

  return { demoControl, loadPhoneMenu: mockedLoadPhoneMenu, location, navigate: undefined, themeStore };
};

const getSectionTitle = (section: AppSectionValue): string => defaultLocaleCatalog[SECTION_TITLE_KEYS[section]];

const getNavigation = (): HTMLElement => screen.getByRole('navigation', { name: defaultLocaleCatalog['app.nav.label'] });

const getMenuButton = (): HTMLElement => screen.getByRole('button', { hidden: true, name: MENU_NAME });

const getAnnouncement = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

const openMenu = async (): Promise<HTMLElement> => {
  fireEvent.click(getMenuButton());

  return screen.findByRole('menu', { name: defaultLocaleCatalog['menu.label'] });
};

const chooseWithEnter = (item: HTMLElement): void => {
  item.focus();
  fireEvent.keyDown(item, { key: 'Enter' });
};

const waitForMenuToClose = async (): Promise<void> => {
  await waitFor(() => {
    expect(screen.queryByRole('menu')).toBeNull();
  });
};

describe('TopBar', () => {
  afterEach(() => {
    cleanup();
  });

  describe('structure', () => {
    it('is the banner of the page with the brand of the organization without translation', async () => {
      await renderTopBar();

      const banner = screen.getByRole('banner');
      const brand = within(banner).getByText(BRAND_NAME);

      expect(brand.getAttribute('translate')).toBe('no');
    });

    it('has a labelled navigation with a link to every given section in order', async () => {
      const sections: AppSectionValue[] = ['network', 'deals', 'warehouse'];
      await renderTopBar({ sections });

      const links = within(getNavigation()).getAllByRole('link');

      expect(links.map(link => link.textContent)).toEqual(sections.map(getSectionTitle));
      expect(links.map(link => link.getAttribute('href'))).toEqual(['#/network', '#/deals', '#/warehouse']);
    });

    it.each(APP_SECTIONS)('marks only the section %s as the current page', async (section) => {
      await renderTopBar({ currentSection: section });

      const current = within(getNavigation()).getAllByRole('link').filter(link => link.getAttribute('aria-current') === 'page');

      expect(current.map(link => link.textContent)).toEqual([getSectionTitle(section)]);
    });

    it('marks no section when there is no current one', async () => {
      await renderTopBar({ currentSection: 'none' });

      const current = within(getNavigation()).getAllByRole('link').filter(link => link.hasAttribute('aria-current'));

      expect(current).toEqual([]);
    });

    it('shows the brand and an empty navigation without sections', async () => {
      await renderTopBar({ sections: [] });

      expect(screen.getByText(BRAND_NAME)).toBeDefined();
      expect(within(getNavigation()).queryAllByRole('link')).toEqual([]);
    });

    it('opens the section by the link and leaves the modified click to the browser', async () => {
      const { location } = await renderTopBar();
      const link = within(getNavigation()).getByRole('link', { name: getSectionTitle('deals') });

      fireEvent.click(link, { ctrlKey: true });
      fireEvent.click(link);

      expect(location.history).toEqual(['/network', '/deals']);
    });

    it('hides the navigation row from phones, where the sections live in the menu', async () => {
      await renderTopBar();

      expect(getNavigation().className).toContain('hidden');
      expect(getNavigation().className).toContain('sm:flex');
    });

    it('reserves an empty place for the clock without any size', async () => {
      await renderTopBar();

      const slot = screen.getByTestId('top-bar-clock-slot');

      expect(slot.childNodes).toHaveLength(0);
      expect(slot.className).toBe('contents');
    });

    it('has the search field', async () => {
      await renderTopBar();

      expect(screen.getByRole('searchbox', { name: defaultLocaleCatalog['search.label'] })).toBeDefined();
    });

    it('has the theme switcher in the banner', async () => {
      await renderTopBar();

      expect(within(screen.getByRole('banner')).getByRole('group', { name: defaultLocaleCatalog['theme.label'] })).toBeDefined();
    });

    it('changes the theme by the switcher', async () => {
      const { themeStore } = await renderTopBar();

      fireEvent.click(within(screen.getByRole('banner')).getByRole('radio', { name: defaultLocaleCatalog['theme.dark'] }));

      expect(themeStore.getPreference()).toBe('dark');
    });
  });

  describe('persona switcher', () => {
    it('draws the node given by the application in the banner', async () => {
      await renderTopBar({ personaSwitcher: <div data-testid={PERSONA_NODE_TEST_ID}>{PERSONA_NODE_TEXT}</div> });

      expect(within(screen.getByRole('banner')).getByTestId(PERSONA_NODE_TEST_ID)).toBeDefined();
    });

    it('draws nothing when no node is given', async () => {
      await renderTopBar();

      expect(screen.queryByTestId(PERSONA_NODE_TEST_ID)).toBeNull();
    });
  });

  describe('demo reset', () => {
    it('has no reset button outside the demo', async () => {
      await renderTopBar();

      expect(screen.queryByRole('button', { name: defaultLocaleCatalog['demo.reset.label'] })).toBeNull();
    });

    it('asks for a confirmation and resets the demo by the button in the banner', async () => {
      const { demoControl } = await renderTopBar({ hasDemo: true });

      fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: defaultLocaleCatalog['demo.reset.label'] }));
      const group = screen.getByRole('group', { name: defaultLocaleCatalog['demo.reset.confirm.prompt'] });

      expect(demoControl.reset).not.toHaveBeenCalled();

      fireEvent.click(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.accept'] }));

      await waitFor(() => {
        expect(demoControl.reset).toHaveBeenCalledOnce();
      });
    });
  });

  describe('phone menu button', () => {
    it('is a collapsed menu button that is the only thing of the menu on the page at the start', async () => {
      const { loadPhoneMenu } = await renderTopBar();
      const button = getMenuButton();

      expect(button.getAttribute('aria-haspopup')).toBe('menu');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.getAttribute('aria-busy')).toBeNull();
      expect(button.className).not.toContain('xl:hidden');
      expect(button.closest('.xl\\:hidden')).not.toBeNull();
      expect(screen.queryByRole('menu')).toBeNull();
      expect(loadPhoneMenu).not.toHaveBeenCalled();
    });

    it('warms the menu up on hover and on focus and loads it once', async () => {
      const { loadPhoneMenu } = await renderTopBar();

      fireEvent.pointerEnter(getMenuButton());
      await waitFor(() => {
        expect(loadPhoneMenu).toHaveBeenCalledTimes(1);
      });
      fireEvent.focus(getMenuButton());

      expect(loadPhoneMenu).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).toBeNull();
      expect(getMenuButton().getAttribute('aria-busy')).toBeNull();
    });

    it('loads the menu on the first press, stays pending with the focus on the button, then opens the menu', async () => {
      const gate = createGate();
      const { loadPhoneMenu } = await renderTopBar({ menuGate: gate });
      const button = getMenuButton();
      button.focus();

      fireEvent.click(button);

      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(button);
      expect(loadPhoneMenu).toHaveBeenCalledTimes(1);

      fireEvent.click(button);

      expect(loadPhoneMenu).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).toBeNull();

      gate.open();

      expect(await screen.findByRole('menu', { name: defaultLocaleCatalog['menu.label'] })).toBeDefined();
      expect(loadPhoneMenu).toHaveBeenCalledTimes(1);
    });

    it('puts the focus on the first item of the menu that opens itself after the load', async () => {
      await renderTopBar();

      const menu = await openMenu();
      const [firstItem] = within(menu).getAllByRole('menuitemradio');

      await waitFor(() => {
        expect(document.activeElement).toBe(firstItem);
      });
    });

    it('opens at once when the menu was warmed up before the press', async () => {
      const { loadPhoneMenu } = await renderTopBar();
      fireEvent.pointerEnter(getMenuButton());
      await waitFor(() => {
        expect(loadPhoneMenu).toHaveBeenCalledTimes(1);
      });
      await act(async () => {
        await Promise.resolve();
      });

      fireEvent.click(getMenuButton());

      expect(screen.getByRole('menu', { name: defaultLocaleCatalog['menu.label'] })).toBeDefined();
      expect(getMenuButton().getAttribute('aria-busy')).toBeNull();
      expect(loadPhoneMenu).toHaveBeenCalledTimes(1);
    });

    it('does not load the menu again on the second opening and keeps the button of the menu', async () => {
      const { loadPhoneMenu } = await renderTopBar();
      const menu = await openMenu();

      fireEvent.keyDown(menu, { key: 'Escape' });
      await waitForMenuToClose();
      await waitFor(() => {
        expect(document.activeElement).toBe(getMenuButton());
      });
      fireEvent.keyDown(getMenuButton(), { key: 'ArrowDown' });

      expect(await screen.findByRole('menu', { name: defaultLocaleCatalog['menu.label'] })).toBeDefined();
      expect(loadPhoneMenu).toHaveBeenCalledTimes(1);
    });

    it('keeps the button usable and tells about the failure when the menu fails to load, then loads it again', async () => {
      const { loadPhoneMenu } = await renderTopBar({ rejectedLoadCount: 1 });
      const button = getMenuButton();

      fireEvent.click(button);

      const alert = await screen.findByRole('alert');

      expect(alert.textContent).toBe(defaultLocaleCatalog['routing.chunkError.message']);
      expect(getMenuButton().getAttribute('aria-busy')).toBeNull();
      expect(getMenuButton().getAttribute('aria-disabled')).toBeNull();
      expect(screen.queryByRole('menu')).toBeNull();

      fireEvent.click(getMenuButton());

      expect(await screen.findByRole('menu', { name: defaultLocaleCatalog['menu.label'] })).toBeDefined();
      expect(loadPhoneMenu).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('stays silent when only the warm-up fails and loads again on the press', async () => {
      const { loadPhoneMenu } = await renderTopBar({ rejectedLoadCount: 1 });

      fireEvent.pointerEnter(getMenuButton());
      await waitFor(() => {
        expect(loadPhoneMenu).toHaveBeenCalledTimes(1);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.queryByRole('alert')).toBeNull();

      fireEvent.click(getMenuButton());

      expect(await screen.findByRole('menu', { name: defaultLocaleCatalog['menu.label'] })).toBeDefined();
      expect(loadPhoneMenu).toHaveBeenCalledTimes(2);
    });
  });

  describe('phone menu', () => {
    it('lists the sections with the current one checked, only for phones', async () => {
      await renderTopBar({ currentSection: 'deals' });

      const menu = await openMenu();
      const group = within(menu).getByRole('group', { name: defaultLocaleCatalog['app.nav.label'] });
      const items = within(group).getAllByRole('menuitemradio');

      expect(items.map(item => item.textContent)).toEqual(APP_SECTIONS.map(getSectionTitle));
      const checkedItems = items.filter(item => item.getAttribute('aria-checked') === 'true');

      expect(checkedItems.map(item => item.textContent)).toEqual([getSectionTitle('deals')]);
      expect(group.closest('.sm\\:hidden')).not.toBeNull();
    });

    it('has no group of sections without sections', async () => {
      await renderTopBar({ sections: [] });

      const menu = await openMenu();

      expect(within(menu).queryByRole('group', { name: defaultLocaleCatalog['app.nav.label'] })).toBeNull();
    });

    it('goes to the chosen section and closes the menu with the focus on its button', async () => {
      const { location } = await renderTopBar();
      const menu = await openMenu();

      chooseWithEnter(within(menu).getByRole('menuitemradio', { name: getSectionTitle('catalog') }));

      await waitForMenuToClose();
      expect(location.history).toEqual(['/network', '/catalog']);
      await waitFor(() => {
        expect(document.activeElement).toBe(getMenuButton());
      });
    });

    it('stays where it is when the current section is chosen', async () => {
      const { location } = await renderTopBar();
      const menu = await openMenu();

      chooseWithEnter(within(menu).getByRole('menuitemradio', { name: getSectionTitle('network') }));

      await waitForMenuToClose();
      expect(location.history).toEqual(['/network']);
    });

    it('changes nothing with the arrow keys, only the highlight moves', async () => {
      const { location, themeStore } = await renderTopBar();
      const menu = await openMenu();

      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      fireEvent.keyDown(menu, { key: 'ArrowUp' });
      fireEvent.keyDown(menu, { key: 'End' });
      fireEvent.keyDown(menu, { key: 'Home' });

      expect(screen.getByRole('menu')).toBeDefined();
      expect(location.history).toEqual(['/network']);
      expect(themeStore.getPreference()).toBe('light');
    });

    it('closes on Escape and returns the focus to the menu button', async () => {
      await renderTopBar();
      const menu = await openMenu();

      fireEvent.keyDown(menu, { key: 'Escape' });

      await waitForMenuToClose();
      await waitFor(() => {
        expect(document.activeElement).toBe(getMenuButton());
      });
      expect(getMenuButton().getAttribute('aria-expanded')).toBe('false');
    });

    it('changes the theme by the chosen item and closes', async () => {
      const { themeStore } = await renderTopBar();
      const menu = await openMenu();
      const group = within(menu).getByRole('group', { name: defaultLocaleCatalog['theme.label'] });

      const lightItem = within(group).getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.light'] });

      expect(lightItem.getAttribute('aria-checked')).toBe('true');

      chooseWithEnter(within(group).getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.dark'] }));

      await waitForMenuToClose();
      expect(themeStore.getPreference()).toBe('dark');
    });

    it('has neither personas nor the reset outside the demo', async () => {
      await renderTopBar();
      const menu = await openMenu();

      expect(within(menu).queryByRole('group', { name: defaultLocaleCatalog['persona.menu.label'] })).toBeNull();
      expect(within(menu).queryByRole('menuitem', { name: RESET_ITEM_NAME })).toBeNull();
    });

    it('has the personas and the reset in the demo', async () => {
      await renderTopBar({ hasDemo: true });
      const menu = await openMenu();

      expect(await within(menu).findByRole('group', { name: defaultLocaleCatalog['persona.menu.label'] })).toBeDefined();
      expect(within(menu).getByRole('menuitem', { name: RESET_ITEM_NAME })).toBeDefined();
    });
  });

  describe('demo reset from the phone menu', () => {
    const openResetConfirm = async (): Promise<HTMLElement> => {
      const menu = await openMenu();

      chooseWithEnter(within(menu).getByRole('menuitem', { name: RESET_ITEM_NAME }));

      return screen.findByRole('group', { name: defaultLocaleCatalog['demo.reset.confirm.prompt'] });
    };

    const waitForSettledFocus = async (): Promise<void> => {
      await act(async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 60);
        });
      });
    };

    it('closes the menu and opens the confirmation inside the banner with the focus on cancel', async () => {
      const { demoControl } = await renderTopBar({ hasDemo: true });

      const group = await openResetConfirm();
      const cancel = within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.cancel'] });
      await waitForSettledFocus();

      expect(screen.queryByRole('menu')).toBeNull();
      expect(screen.getByRole('banner').contains(group)).toBe(true);
      expect(document.activeElement).toBe(cancel);
      expect(demoControl.reset).not.toHaveBeenCalled();
    });

    it('goes back with the focus on the menu button on cancel', async () => {
      const { demoControl } = await renderTopBar({ hasDemo: true });
      const group = await openResetConfirm();
      await waitForSettledFocus();

      fireEvent.click(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.cancel'] }));

      expect(screen.queryByRole('group', { name: defaultLocaleCatalog['demo.reset.confirm.prompt'] })).toBeNull();
      expect(document.activeElement).toBe(getMenuButton());
      expect(demoControl.reset).not.toHaveBeenCalled();
    });

    it('goes back with the focus on the menu button on Escape', async () => {
      await renderTopBar({ hasDemo: true });
      const group = await openResetConfirm();
      await waitForSettledFocus();

      fireEvent.keyDown(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.cancel'] }), { key: 'Escape' });

      expect(screen.queryByRole('group', { name: defaultLocaleCatalog['demo.reset.confirm.prompt'] })).toBeNull();
      expect(document.activeElement).toBe(getMenuButton());
    });

    it('resets the demo, announces it and returns the focus to the menu button', async () => {
      const { demoControl } = await renderTopBar({ hasDemo: true });
      const group = await openResetConfirm();
      await waitForSettledFocus();

      fireEvent.click(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.accept'] }));

      await waitFor(() => {
        expect(demoControl.reset).toHaveBeenCalledOnce();
      });
      await waitFor(() => {
        expect(screen.queryByRole('group', { name: defaultLocaleCatalog['demo.reset.confirm.prompt'] })).toBeNull();
      });
      expect(document.activeElement).toBe(getMenuButton());
      expect(getAnnouncement()).toBe(defaultLocaleCatalog['demo.reset.done']);
    });
  });
});
