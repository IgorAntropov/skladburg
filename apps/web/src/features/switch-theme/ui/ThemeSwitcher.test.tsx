import {
  cleanup,
  fireEvent,
  render,
  screen,
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
import { FakeMediaQueryList } from '@/shared/theme/index.testing';

import { ThemeSwitcher } from './ThemeSwitcher';

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const renderSwitcher = async (store: IThemePreferenceStore): Promise<void> => {
  const localizer = await createTestLocalizer();

  render(
    <LocalizerProvider localizer={localizer}>
      <ThemePreferenceProvider store={store}>
        <ThemeSwitcher />
      </ThemePreferenceProvider>
    </LocalizerProvider>,
  );
};

const getOption = (labelKey: 'theme.dark' | 'theme.light' | 'theme.system'): HTMLInputElement => {
  const option = screen.getByRole('radio', { name: defaultLocaleCatalog[labelKey] });

  if (!(option instanceof HTMLInputElement)) {
    throw new TypeError('The theme option is not an input');
  }

  return option;
};

describe('ThemeSwitcher', () => {
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
    await renderSwitcher(store);

    expect(screen.getByRole('group', { name: defaultLocaleCatalog['theme.label'] })).toBeDefined();
    expect(screen.getAllByRole('radio').map(option => option.getAttribute('value'))).toEqual(['light', 'dark', 'system']);
  });

  it('marks only the current preference', async () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    store.setPreference('dark');
    await renderSwitcher(store);

    expect(getOption('theme.dark').checked).toBe(true);
    expect(getOption('theme.light').checked).toBe(false);
    expect(getOption('theme.system').checked).toBe(false);
  });

  it('changes the preference of the store and the theme of the document on the choice of dark', async () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    unbind = bindThemeToDocument(store, document.documentElement);
    await renderSwitcher(store);

    expect(document.documentElement.dataset.theme).toBe('light');

    fireEvent.click(getOption('theme.dark'));

    expect(store.getPreference()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(getOption('theme.dark').checked).toBe(true);
  });

  it('follows the system theme on the choice of the system variant', async () => {
    const query = new FakeMediaQueryList(true);
    const store = createThemePreferenceStore({ colorSchemeQuery: query, storage: undefined, storageEvents: undefined });
    store.setPreference('light');
    unbind = bindThemeToDocument(store, document.documentElement);
    await renderSwitcher(store);

    fireEvent.click(getOption('theme.system'));

    expect(store.getPreference()).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('shows a change made from outside', async () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    await renderSwitcher(store);

    store.setPreference('dark');

    expect(await screen.findByRole('radio', { checked: true, name: defaultLocaleCatalog['theme.dark'] })).toBeDefined();
  });
});
