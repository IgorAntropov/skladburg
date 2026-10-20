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
import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import { APP_SECTIONS } from '@/shared/routing';

import type { GateValue } from '../lib/testing/profileMenuHarness';

import { createGate } from '../lib/testing/profileMenuHarness';

type LoadProfileMenuType = typeof import('./loadProfileMenu').loadProfileMenu;

vi.mock('./loadProfileMenu', () => ({ loadProfileMenu: vi.fn() }));

const MENU_NAME = defaultLocaleCatalog['profile.menu.label'];
const RESET_ITEM_NAME = defaultLocaleCatalog['demo.reset.menuItem'];
const RESET_PROMPT_NAME = defaultLocaleCatalog['demo.reset.confirm.prompt'];
const READY_BUTTON_NAME = defaultLocaleCatalog['profile.button.label']
  .replace('{name}', 'Анна Смирнова')
  .replace('{organization}', 'Заказчик 1');
const RESETTING_BUTTON_NAME = defaultLocaleCatalog['profile.button.resetting'];
const CHUNK_ERROR_MESSAGE = defaultLocaleCatalog['profile.menu.loadError.message'];
const CHUNK_ERROR_REPEATED = defaultLocaleCatalog['profile.menu.loadError.repeated'];
const RETRY_NAME = defaultLocaleCatalog['common.retry'];
const RELOAD_NAME = defaultLocaleCatalog['routing.chunkError.reload'];

interface RenderedLauncherValue {
  demoControl: IDemoControl;
  loadProfileMenu: LoadProfileMenuType;
  location: IMemoryLocation;
}

interface RenderLauncherOptionsValue {
  hasDemo?: boolean;
  menuGate?: GateValue;
  rejectedLoadCount?: number;
}

let installedViewport: IFakeViewport | undefined;

const renderLauncher = async ({
  hasDemo = false,
  menuGate,
  rejectedLoadCount = 0,
}: RenderLauncherOptionsValue = {}): Promise<RenderedLauncherValue> => {
  vi.resetModules();
  installedViewport?.restore();
  installedViewport = installFakeViewport('desktop');

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
  const location = createMemoryLocation('/network');
  const themeStore = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
  const demoControl = harness.createProfileDemoControl();
  const runtime = createTestRuntime({
    demoControl: hasDemo ? demoControl : undefined,
    routes: harness.createProfileRoutes(),
  });
  runtime.actingContext.set(harness.PROFILE_ACTING_CONTEXT);

  render(
    <harness.ProfileTreeProviders localizer={localizer} location={location} runtime={runtime} themeStore={themeStore}>
      <ProfileMenuLauncher currentSection="network" sections={APP_SECTIONS} />
    </harness.ProfileTreeProviders>,
  );

  return { demoControl, loadProfileMenu: mockedLoadProfileMenu, location };
};

const getButton = (): HTMLElement => screen.getByRole('button', { hidden: true, name: /^Профиль/ });

const getAnnouncement = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

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

const waitForMenuLoad = async (loadProfileMenu: LoadProfileMenuType): Promise<void> => {
  await act(async () => {
    await vi.mocked(loadProfileMenu).mock.results[0]?.value;
  });
};

describe('ProfileMenuLauncher', () => {
  afterEach(() => {
    cleanup();
    installedViewport?.restore();
    installedViewport = undefined;
  });

  describe('profile button', () => {
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
      await waitForMenuLoad(loadProfileMenu);

      expect(await screen.findByRole('menu', { name: MENU_NAME })).toBeDefined();
      expect(loadProfileMenu).toHaveBeenCalledTimes(1);
    });

    it('opens at once when the menu was warmed up before the press', async () => {
      const { loadProfileMenu } = await renderLauncher();
      await waitForReadyButton();
      fireEvent.pointerEnter(getButton());
      await waitFor(() => {
        expect(loadProfileMenu).toHaveBeenCalledTimes(1);
      });
      await waitForMenuLoad(loadProfileMenu);

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

    it('offers a retry that loads the menu again after the first failure', async () => {
      const { loadProfileMenu, location } = await renderLauncher({ rejectedLoadCount: 1 });
      await waitForReadyButton();
      fireEvent.click(getButton());
      await screen.findByRole('alert');

      fireEvent.click(screen.getByRole('button', { name: RETRY_NAME }));

      expect(await screen.findByRole('menu', { name: MENU_NAME })).toBeDefined();
      expect(loadProfileMenu).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(location.reloadCount).toBe(0);
    });

    it('offers to reload the page instead of a retry when the menu fails to load the second time', async () => {
      const { loadProfileMenu, location } = await renderLauncher({ rejectedLoadCount: 2 });
      await waitForReadyButton();
      fireEvent.click(getButton());
      await screen.findByRole('alert');

      fireEvent.click(screen.getByRole('button', { name: RETRY_NAME }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toBe(CHUNK_ERROR_REPEATED);
      });
      expect(screen.queryByRole('button', { name: RETRY_NAME })).toBeNull();
      expect(loadProfileMenu).toHaveBeenCalledTimes(2);

      fireEvent.click(screen.getByRole('button', { name: RELOAD_NAME }));

      expect(location.reloadCount).toBe(1);
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

    it('does not open the menu and keeps the confirmation while the reset runs, then opens it again', async () => {
      const response = createGate();
      const { demoControl } = await renderLauncher({ hasDemo: true });
      vi.mocked(demoControl.reset).mockImplementation(() => response.promise);
      const group = await openResetConfirm();
      await waitForSettledFocus();
      const button = getButton();
      fireEvent.click(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.accept'] }));
      await within(group).findByRole('button', { name: defaultLocaleCatalog['demo.reset.pending'] });

      fireEvent.keyDown(button, { key: 'ArrowDown' });
      fireEvent.click(button);
      await settleMicrotasks();

      expect(screen.queryByRole('menu')).toBeNull();
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(screen.getByRole('group', { name: RESET_PROMPT_NAME })).toBe(group);

      await act(async () => {
        response.open();
        await response.promise;
      });
      await waitFor(() => {
        expect(screen.queryByRole('group', { name: RESET_PROMPT_NAME })).toBeNull();
      });

      fireEvent.keyDown(getButton(), { key: 'ArrowDown' });

      expect(await screen.findByRole('menu', { name: MENU_NAME })).toBeDefined();
    });

    it('shows the button of the profile busy under its own name while the reset runs', async () => {
      const response = createGate();
      const { demoControl } = await renderLauncher({ hasDemo: true });
      vi.mocked(demoControl.reset).mockImplementation(() => response.promise);
      const group = await openResetConfirm();
      await waitForSettledFocus();
      const button = getButton();

      expect(button.getAttribute('aria-busy')).toBeNull();

      fireEvent.click(within(group).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.accept'] }));
      await within(group).findByRole('button', { name: defaultLocaleCatalog['demo.reset.pending'] });

      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.getAttribute('aria-label')).toBe(RESETTING_BUTTON_NAME);
      expect(screen.getByRole('button', { hidden: true, name: RESETTING_BUTTON_NAME })).toBe(button);

      await act(async () => {
        response.open();
        await response.promise;
      });
      await waitFor(() => {
        expect(button.getAttribute('aria-busy')).toBeNull();
      });

      expect(button.getAttribute('aria-label')).toBe(READY_BUTTON_NAME);
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
