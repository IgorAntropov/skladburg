import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  act,
  cleanup,
  fireEvent,
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

import type { IDemoControl } from '@/shared/api';
import type { ViewportClassValue } from '@/shared/lib/viewport';
import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { AppSectionValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';
import type { IThemePreferenceStore } from '@/shared/theme';

import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import {
  APP_SECTIONS,
  SECTION_TITLE_KEYS,
} from '@/shared/routing';

import type { GateValue } from '../lib/testing/profileMenuHarness';

import { createGate } from '../lib/testing/profileMenuHarness';

type LoadProfileMenuType = typeof import('./loadProfileMenu').loadProfileMenu;

vi.mock('./loadProfileMenu', () => ({ loadProfileMenu: vi.fn() }));

const MENU_NAME = defaultLocaleCatalog['profile.menu.label'];
const RESET_ITEM_NAME = defaultLocaleCatalog['demo.reset.menuItem'];
const RESET_PROMPT_NAME = defaultLocaleCatalog['demo.reset.confirm.prompt'];
const READY_BUTTON_NAME = defaultLocaleCatalog['profile.button.label']
  .replace('{name}', 'Анна Смирнова')
  .replace('{organization}', 'Покупатель 1');
const CHUNK_ERROR_MESSAGE = defaultLocaleCatalog['routing.chunkError.message'];

interface RenderedLauncherValue {
  demoControl: IDemoControl;
  loadProfileMenu: LoadProfileMenuType;
  location: IMemoryLocation;
  themeStore: IThemePreferenceStore;
}

interface RenderLauncherOptionsValue {
  currentSection?: AppSectionValue;
  hasDemo?: boolean;
  menuGate?: GateValue;
  rejectedLoadCount?: number;
  sections?: readonly AppSectionValue[];
  sides?: readonly ProfileKind[];
  viewportClass?: ViewportClassValue;
}

let installedViewport: IFakeViewport | undefined;

const renderLauncher = async ({
  currentSection = 'network',
  hasDemo = false,
  menuGate,
  rejectedLoadCount = 0,
  sections = APP_SECTIONS,
  sides = [ProfileKind.BUYER],
  viewportClass = 'desktop',
}: RenderLauncherOptionsValue = {}): Promise<RenderedLauncherValue> => {
  vi.resetModules();
  installedViewport?.restore();
  installedViewport = installFakeViewport(viewportClass);

  const [
    { createTestRuntime },
    { createMemoryLocation },
    { createThemePreferenceStore },
    { render },
    harness,
    { loadProfileMenu: mockedLoadProfileMenu },
    { ProfileMenuLauncher },
  ] = await Promise.all([
    import('@/shared/api/index.testing'),
    import('@/shared/routing/index.testing'),
    import('@/shared/theme'),
    import('@testing-library/react'),
    import('../lib/testing/profileMenuHarness'),
    import('./loadProfileMenu'),
    import('./ProfileMenuLauncher'),
  ]);

  const actualModule = await vi.importActual<typeof import('./loadProfileMenu')>('./loadProfileMenu');
  const loadActualProfileMenu: LoadProfileMenuType = menuGate === undefined
    ? actualModule.loadProfileMenu
    : () => menuGate.promise.then(actualModule.loadProfileMenu);

  let rejectedCount = 0;
  const loadWithRejections: LoadProfileMenuType = () => {
    if (rejectedCount < rejectedLoadCount) {
      rejectedCount += 1;

      return Promise.reject(new Error('the menu chunk is unavailable'));
    }

    return loadActualProfileMenu();
  };

  vi.mocked(mockedLoadProfileMenu).mockReset();
  vi.mocked(mockedLoadProfileMenu).mockImplementation(loadWithRejections);

  const localizer = await harness.createProfileLocalizer();
  const location = createMemoryLocation(`/${currentSection}`);
  const themeStore = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
  const demoControl = harness.createProfileDemoControl();
  const runtime = createTestRuntime({
    demoControl: hasDemo ? demoControl : undefined,
    routes: harness.createProfileRoutes({ sides }),
  });
  runtime.actingContext.set(harness.PROFILE_ACTING_CONTEXT);

  render(
    <harness.ProfileTreeProviders localizer={localizer} location={location} runtime={runtime} themeStore={themeStore}>
      <ProfileMenuLauncher currentSection={currentSection} sections={sections} />
    </harness.ProfileTreeProviders>,
  );

  return { demoControl, loadProfileMenu: mockedLoadProfileMenu, location, themeStore };
};

const getButton = (): HTMLElement => screen.getByRole('button', { hidden: true, name: /^Профиль/ });

const getAnnouncement = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

const getSectionTitle = (section: AppSectionValue): string => defaultLocaleCatalog[SECTION_TITLE_KEYS[section]];

const waitForReadyButton = async (): Promise<void> => {
  await screen.findByRole('button', { hidden: true, name: READY_BUTTON_NAME });
};

const openMenu = async (): Promise<HTMLElement> => {
  await waitForReadyButton();
  fireEvent.click(getButton());

  return screen.findByRole('menu', { name: MENU_NAME });
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

const waitForSettledFocus = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 60);
    });
  });
};

const settleMicrotasks = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('ProfileMenuLauncher', () => {
  afterEach(() => {
    cleanup();
    installedViewport?.restore();
    installedViewport = undefined;
  });

  describe('profile button', () => {
    it('is a collapsed menu button and the only thing of the menu on the page at the start', async () => {
      const { loadProfileMenu } = await renderLauncher();
      await waitForReadyButton();
      const button = getButton();

      expect(button.getAttribute('aria-haspopup')).toBe('menu');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.getAttribute('aria-busy')).toBeNull();
      expect(screen.queryByRole('menu')).toBeNull();
      expect(loadProfileMenu).not.toHaveBeenCalled();
    });

    it('warms the menu up on hover and on focus and loads it once', async () => {
      const { loadProfileMenu } = await renderLauncher();

      fireEvent.pointerEnter(getButton());
      await waitFor(() => {
        expect(loadProfileMenu).toHaveBeenCalledTimes(1);
      });
      fireEvent.focus(getButton());

      expect(loadProfileMenu).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).toBeNull();
      expect(getButton().getAttribute('aria-busy')).toBeNull();
    });

    it('warms the menu up on focus alone', async () => {
      const { loadProfileMenu } = await renderLauncher();

      fireEvent.focus(getButton());

      await waitFor(() => {
        expect(loadProfileMenu).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('loads the menu on the first press, stays busy with the focus on the button, then opens the menu', async () => {
      const gate = createGate();
      const { loadProfileMenu } = await renderLauncher({ menuGate: gate });
      await waitForReadyButton();
      const button = getButton();
      button.focus();

      fireEvent.click(button);

      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(button);
      expect(loadProfileMenu).toHaveBeenCalledTimes(1);

      fireEvent.click(button);

      expect(loadProfileMenu).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).toBeNull();

      gate.open();

      expect(await screen.findByRole('menu', { name: MENU_NAME })).toBeDefined();
      expect(loadProfileMenu).toHaveBeenCalledTimes(1);
    });

    it('puts the focus on the first item of the menu that opens itself after the load', async () => {
      await renderLauncher();

      const menu = await openMenu();
      const [firstItem] = within(menu).getAllByRole('menuitemradio');

      await waitFor(() => {
        expect(document.activeElement).toBe(firstItem);
      });
    });

    it('opens at once when the menu was warmed up before the press', async () => {
      const { loadProfileMenu } = await renderLauncher();
      await waitForReadyButton();
      fireEvent.pointerEnter(getButton());
      await waitFor(() => {
        expect(loadProfileMenu).toHaveBeenCalledTimes(1);
      });
      await settleMicrotasks();

      fireEvent.click(getButton());

      expect(screen.getByRole('menu', { name: MENU_NAME })).toBeDefined();
      expect(getButton().getAttribute('aria-busy')).toBeNull();
      expect(loadProfileMenu).toHaveBeenCalledTimes(1);
    });

    it('does not load the menu again on the second opening and keeps the button of the menu', async () => {
      const { loadProfileMenu } = await renderLauncher();
      const menu = await openMenu();

      fireEvent.keyDown(menu, { key: 'Escape' });
      await waitForMenuToClose();
      await waitFor(() => {
        expect(document.activeElement).toBe(getButton());
      });
      fireEvent.keyDown(getButton(), { key: 'ArrowDown' });

      expect(await screen.findByRole('menu', { name: MENU_NAME })).toBeDefined();
      expect(loadProfileMenu).toHaveBeenCalledTimes(1);
    });

    it('keeps the button usable and tells about the failure when the menu fails to load, then loads it again', async () => {
      const { loadProfileMenu } = await renderLauncher({ rejectedLoadCount: 1 });
      await waitForReadyButton();

      fireEvent.click(getButton());

      const alert = await screen.findByRole('alert');

      expect(alert.textContent).toBe(CHUNK_ERROR_MESSAGE);
      expect(getButton().getAttribute('aria-busy')).toBeNull();
      expect(getButton().getAttribute('aria-disabled')).toBeNull();
      expect(screen.queryByRole('menu')).toBeNull();

      fireEvent.click(getButton());

      expect(await screen.findByRole('menu', { name: MENU_NAME })).toBeDefined();
      expect(loadProfileMenu).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('stays silent when only the warm-up fails and loads again on the press', async () => {
      const { loadProfileMenu } = await renderLauncher({ rejectedLoadCount: 1 });
      await waitForReadyButton();

      fireEvent.pointerEnter(getButton());
      await waitFor(() => {
        expect(loadProfileMenu).toHaveBeenCalledTimes(1);
      });
      await settleMicrotasks();

      expect(screen.queryByRole('alert')).toBeNull();

      fireEvent.click(getButton());

      expect(await screen.findByRole('menu', { name: MENU_NAME })).toBeDefined();
      expect(loadProfileMenu).toHaveBeenCalledTimes(2);
    });

    it('closes on Escape and returns the focus to the button', async () => {
      await renderLauncher();
      const menu = await openMenu();

      fireEvent.keyDown(menu, { key: 'Escape' });

      await waitForMenuToClose();
      await waitFor(() => {
        expect(document.activeElement).toBe(getButton());
      });
      expect(getButton().getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('menu', () => {
    it('lists the sections of a phone and goes to the chosen one with the focus back on the button', async () => {
      const { location } = await renderLauncher({ viewportClass: 'phone' });
      const menu = await openMenu();

      const group = within(menu).getByRole('group', { name: defaultLocaleCatalog['app.nav.label'] });
      chooseWithEnter(within(group).getByRole('menuitemradio', { name: getSectionTitle('catalog') }));

      await waitForMenuToClose();
      expect(location.history).toEqual(['/network', '/catalog']);
      await waitFor(() => {
        expect(document.activeElement).toBe(getButton());
      });
    });

    it('has no sections on a tablet', async () => {
      await renderLauncher({ viewportClass: 'tablet' });
      const menu = await openMenu();

      expect(within(menu).queryByRole('group', { name: defaultLocaleCatalog['app.nav.label'] })).toBeNull();
    });

    it('changes the theme by the chosen item', async () => {
      const { themeStore } = await renderLauncher();
      const menu = await openMenu();

      chooseWithEnter(within(menu).getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.dark'] }));

      expect(themeStore.getPreference()).toBe('dark');
    });
  });

  describe('demo reset', () => {
    const openResetConfirm = async (): Promise<HTMLElement> => {
      const menu = await openMenu();

      chooseWithEnter(within(menu).getByRole('menuitem', { name: RESET_ITEM_NAME }));

      return screen.findByRole('group', { name: RESET_PROMPT_NAME });
    };

    it('closes the menu and opens the confirmation under the button with the focus on cancel', async () => {
      const { demoControl } = await renderLauncher({ hasDemo: true });

      const group = await openResetConfirm();
      const cancel = within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.cancel'] });
      await waitForSettledFocus();

      expect(screen.queryByRole('menu')).toBeNull();
      expect(getButton().parentElement?.contains(group)).toBe(true);
      expect(document.activeElement).toBe(cancel);
      expect(demoControl.reset).not.toHaveBeenCalled();
    });

    it('does not show the confirmation until the menu is closed', async () => {
      await renderLauncher({ hasDemo: true });
      const menu = await openMenu();

      chooseWithEnter(within(menu).getByRole('menuitem', { name: RESET_ITEM_NAME }));

      expect(screen.queryByRole('group', { name: RESET_PROMPT_NAME })).toBeNull();
      await screen.findByRole('group', { name: RESET_PROMPT_NAME });
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('goes back with the focus on the button on cancel', async () => {
      const { demoControl } = await renderLauncher({ hasDemo: true });
      const group = await openResetConfirm();
      await waitForSettledFocus();

      fireEvent.click(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.cancel'] }));

      expect(screen.queryByRole('group', { name: RESET_PROMPT_NAME })).toBeNull();
      expect(document.activeElement).toBe(getButton());
      expect(demoControl.reset).not.toHaveBeenCalled();
    });

    it('goes back with the focus on the button on Escape', async () => {
      await renderLauncher({ hasDemo: true });
      const group = await openResetConfirm();
      await waitForSettledFocus();

      fireEvent.keyDown(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.cancel'] }), { key: 'Escape' });

      expect(screen.queryByRole('group', { name: RESET_PROMPT_NAME })).toBeNull();
      expect(document.activeElement).toBe(getButton());
    });

    it('resets the demo, announces it and returns the focus to the button', async () => {
      const { demoControl } = await renderLauncher({ hasDemo: true });
      const group = await openResetConfirm();
      await waitForSettledFocus();

      fireEvent.click(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.accept'] }));

      await waitFor(() => {
        expect(demoControl.reset).toHaveBeenCalledOnce();
      });
      await waitFor(() => {
        expect(screen.queryByRole('group', { name: RESET_PROMPT_NAME })).toBeNull();
      });
      expect(document.activeElement).toBe(getButton());
      expect(getAnnouncement()).toBe(defaultLocaleCatalog['demo.reset.done']);
    });

    it('closes the confirmation when the menu is opened again', async () => {
      const { demoControl } = await renderLauncher({ hasDemo: true });
      await openResetConfirm();
      await waitForSettledFocus();

      fireEvent.keyDown(getButton(), { key: 'ArrowDown' });
      await screen.findByRole('menu', { name: MENU_NAME });

      expect(screen.queryByRole('group', { name: RESET_PROMPT_NAME })).toBeNull();
      expect(demoControl.reset).not.toHaveBeenCalled();
    });

    it('does not open the menu and keeps the confirmation while the reset runs', async () => {
      const response = createGate();
      const { demoControl } = await renderLauncher({ hasDemo: true });
      vi.mocked(demoControl.reset).mockImplementation(() => response.promise);
      const group = await openResetConfirm();
      await waitForSettledFocus();
      fireEvent.click(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.accept'] }));
      await within(group).findByRole('button', { name: defaultLocaleCatalog['demo.reset.pending'] });

      fireEvent.keyDown(getButton(), { key: 'ArrowDown' });
      fireEvent.click(getButton());
      await settleMicrotasks();

      expect(screen.queryByRole('menu')).toBeNull();
      expect(getButton().getAttribute('aria-expanded')).toBe('false');
      expect(screen.getByRole('group', { name: RESET_PROMPT_NAME })).toBe(group);

      await act(async () => {
        response.open();
        await response.promise;
      });
      await waitFor(() => {
        expect(screen.queryByRole('group', { name: RESET_PROMPT_NAME })).toBeNull();
      });
    });

    it('can ask again after the cancel', async () => {
      await renderLauncher({ hasDemo: true });
      const group = await openResetConfirm();
      await waitForSettledFocus();
      fireEvent.click(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.cancel'] }));

      fireEvent.keyDown(getButton(), { key: 'ArrowDown' });
      const menu = await screen.findByRole('menu', { name: MENU_NAME });
      chooseWithEnter(within(menu).getByRole('menuitem', { name: RESET_ITEM_NAME }));

      expect(await screen.findByRole('group', { name: RESET_PROMPT_NAME })).toBeDefined();
    });
  });
});
