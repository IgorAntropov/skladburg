import type { ReactElement } from 'react';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ILocalizer } from '@/shared/i18n';
import type { IThemePreferenceStore } from '@/shared/theme';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import {
  bindThemeToDocument,
  createThemePreferenceStore,
  ThemePreferenceProvider,
} from '@/shared/theme';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/ui';

import { ThemeMenuRadioGroup } from './ThemeMenuRadioGroup';

const TRIGGER_TEXT = 'Menu';
const MENU_LABEL = 'Settings';

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const ThemeMenu = (): ReactElement => (
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Button>{TRIGGER_TEXT}</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent label={MENU_LABEL}>
      <ThemeMenuRadioGroup />
    </DropdownMenuContent>
  </DropdownMenu>
);

const renderMenu = async (store: IThemePreferenceStore): Promise<HTMLElement> => {
  const localizer = await createTestLocalizer();

  render(
    <LocalizerProvider localizer={localizer}>
      <ThemePreferenceProvider store={store}>
        <ThemeMenu />
      </ThemePreferenceProvider>
    </LocalizerProvider>,
  );

  const trigger = screen.getByRole('button', { name: TRIGGER_TEXT });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  await screen.findByRole('menu');

  return trigger;
};

describe('ThemeMenuRadioGroup', () => {
  let unbind: () => void = () => undefined;

  beforeEach(() => {
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    unbind();
    cleanup();
    delete document.documentElement.dataset.theme;
  });

  it('names the group by the theme label and offers the three variants', async () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    await renderMenu(store);

    expect(screen.getByRole('group', { name: defaultLocaleCatalog['theme.label'] })).toBeDefined();
    expect(screen.getAllByRole('menuitemradio').map(item => item.getAttribute('aria-label'))).toEqual([
      defaultLocaleCatalog['theme.light'],
      defaultLocaleCatalog['theme.dark'],
      defaultLocaleCatalog['theme.system'],
    ]);
  });

  it('shows the variants as icons only, in one row of three', async () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    await renderMenu(store);

    const items = screen.getAllByRole('menuitemradio');
    const rows = new Set(items.map(item => item.parentElement));

    expect(rows.size).toBe(1);
    expect(items.map(item => item.textContent)).toEqual(['', '', '']);
    expect(items.every(item => item.querySelector('svg[aria-hidden="true"]') !== null)).toBe(true);
  });

  it('walks over the three variants with the arrow keys of the menu', async () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    store.setPreference('system');
    await renderMenu(store);
    const light = screen.getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.light'] });
    const dark = screen.getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.dark'] });
    const system = screen.getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.system'] });

    system.focus();
    fireEvent.keyDown(system, { key: 'ArrowUp' });

    await waitFor(() => {
      expect(document.activeElement).toBe(dark);
    });

    fireEvent.keyDown(dark, { key: 'ArrowUp' });

    await waitFor(() => {
      expect(document.activeElement).toBe(light);
    });
    expect(store.getPreference()).toBe('system');
  });

  it('marks only the current preference', async () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    store.setPreference('system');
    await renderMenu(store);

    expect(screen.getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.system'] }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.light'] }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.dark'] }).getAttribute('aria-checked')).toBe('false');
  });

  it('changes the theme only by the choice of an item and closes the menu', async () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    unbind = bindThemeToDocument(store, document.documentElement);
    const trigger = await renderMenu(store);

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });

    expect(store.getPreference()).toBe('light');

    const dark = screen.getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.dark'] });
    dark.focus();
    fireEvent.keyDown(dark, { key: 'Enter' });

    expect(store.getPreference()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });
});
