import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IThemePreferenceStore } from './themeTypes';

import { createThemePreferenceStore } from './createThemePreferenceStore';
import {
  createFakeStorage,
  FakeMediaQueryList,
  FakeStorageEvents,
} from './testing/themeFakes';
import { THEME_STORAGE_KEY } from './themePersistence';

interface CreateStoreOptionsValue {
  isQueryMatching?: boolean;
  storage?: Storage | undefined;
}

const createStore = ({ isQueryMatching = false, storage }: CreateStoreOptionsValue = {}): {
  events: FakeStorageEvents;
  query: FakeMediaQueryList;
  store: IThemePreferenceStore;
} => {
  const query = new FakeMediaQueryList(isQueryMatching);
  const events = new FakeStorageEvents();

  return {
    events,
    query,
    store: createThemePreferenceStore({ colorSchemeQuery: query, storage, storageEvents: events }),
  };
};

describe('createThemePreferenceStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with the light theme when nothing is stored', () => {
    const { store } = createStore({ storage: createFakeStorage() });

    expect(store.getPreference()).toBe('light');
    expect(store.getResolvedTheme()).toBe('light');
  });

  it.each([
    { expectedTheme: 'dark', stored: 'dark' },
    { expectedTheme: 'light', stored: 'light' },
  ])('starts with the stored preference $stored', ({ expectedTheme, stored }) => {
    const storage = createFakeStorage({ initial: { [THEME_STORAGE_KEY]: stored } });
    const { store } = createStore({ isQueryMatching: true, storage });

    expect(store.getPreference()).toBe(stored);
    expect(store.getResolvedTheme()).toBe(expectedTheme);
  });

  it.each([
    { expectedTheme: 'dark', isQueryMatching: true },
    { expectedTheme: 'light', isQueryMatching: false },
  ])('resolves the system preference when the color scheme query matches: $isQueryMatching', ({ expectedTheme, isQueryMatching }) => {
    const storage = createFakeStorage({ initial: { [THEME_STORAGE_KEY]: 'system' } });
    const { store } = createStore({ isQueryMatching, storage });

    expect(store.getPreference()).toBe('system');
    expect(store.getResolvedTheme()).toBe(expectedTheme);
  });

  it('resolves the system preference to light when the device cannot report the color scheme', () => {
    const store = createThemePreferenceStore({
      colorSchemeQuery: undefined,
      storage: createFakeStorage({ initial: { [THEME_STORAGE_KEY]: 'system' } }),
      storageEvents: undefined,
    });

    expect(store.getResolvedTheme()).toBe('light');
  });

  it.each(['', 'DARK', 'blue', '{"theme":"dark"}'])('falls back to light for the corrupted stored value %j', (corrupted) => {
    const { store } = createStore({ storage: createFakeStorage({ initial: { [THEME_STORAGE_KEY]: corrupted } }) });

    expect(store.getPreference()).toBe('light');
    expect(store.getResolvedTheme()).toBe('light');
  });

  it('falls back to light and reports it when reading the storage throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { store } = createStore({ storage: createFakeStorage({ isGetFailing: true }) });

    expect(store.getPreference()).toBe('light');
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]?.[0]).toBe('> themePersistence -> readStoredThemePreference:');
    expect(consoleError.mock.calls[0]?.[1]).toHaveProperty('error');
  });

  it('works without a storage', () => {
    const { store } = createStore({ storage: undefined });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setPreference('dark');

    expect(store.getPreference()).toBe('dark');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('writes the chosen preference to the storage and notifies the subscribers', () => {
    const storage = createFakeStorage();
    const { store } = createStore({ storage });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setPreference('dark');

    expect(storage.values.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(store.getPreference()).toBe('dark');
    expect(store.getResolvedTheme()).toBe('dark');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('does not write or notify when the preference stays the same', () => {
    const storage = createFakeStorage({ initial: { [THEME_STORAGE_KEY]: 'dark' } });
    const setItem = vi.spyOn(storage, 'setItem');
    const { store } = createStore({ storage });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setPreference('dark');

    expect(setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the chosen preference for the session and reports it when writing the storage throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { store } = createStore({ storage: createFakeStorage({ isSetFailing: true }) });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setPreference('dark');

    expect(store.getPreference()).toBe('dark');
    expect(store.getResolvedTheme()).toBe('dark');
    expect(listener).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]?.[0]).toBe('> themePersistence -> writeStoredThemePreference:');
    expect(consoleError.mock.calls[0]?.[1]).toMatchObject({ preference: 'dark' });
  });

  it('stops notifying a subscriber after it unsubscribes', () => {
    const { store } = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.setPreference('dark');

    expect(listener).not.toHaveBeenCalled();
  });

  it('follows the color scheme of the device on the fly while the preference is system', () => {
    const { query, store } = createStore();
    store.setPreference('system');
    const listener = vi.fn();
    store.subscribe(listener);

    query.change(true);

    expect(store.getResolvedTheme()).toBe('dark');
    expect(store.getPreference()).toBe('system');
    expect(listener).toHaveBeenCalledOnce();

    query.change(false);

    expect(store.getResolvedTheme()).toBe('light');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify when the color scheme changes but the preference is fixed', () => {
    const { query, store } = createStore();
    store.setPreference('dark');
    const listener = vi.fn();
    store.subscribe(listener);

    query.change(true);
    query.change(false);

    expect(listener).not.toHaveBeenCalled();
    expect(store.getResolvedTheme()).toBe('dark');
  });

  it('does not notify when the color scheme event does not change the resolved theme', () => {
    const { query, store } = createStore({ isQueryMatching: true });
    store.setPreference('system');
    const listener = vi.fn();
    store.subscribe(listener);

    query.change(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies when the preference changes while the resolved theme stays the same', () => {
    const { store } = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setPreference('system');

    expect(store.getPreference()).toBe('system');
    expect(store.getResolvedTheme()).toBe('light');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('applies the preference chosen in another tab without writing it back', () => {
    const storage = createFakeStorage();
    const { events, store } = createStore({ storage });
    const listener = vi.fn();
    store.subscribe(listener);

    storage.setItem(THEME_STORAGE_KEY, 'dark');
    const setItem = vi.spyOn(storage, 'setItem');
    events.emit(THEME_STORAGE_KEY, 'dark', storage);

    expect(store.getPreference()).toBe('dark');
    expect(store.getResolvedTheme()).toBe('dark');
    expect(listener).toHaveBeenCalledOnce();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('takes the value from the storage and not from the event', () => {
    const storage = createFakeStorage({ initial: { [THEME_STORAGE_KEY]: 'dark' } });
    const { events, store } = createStore({ storage });

    storage.setItem(THEME_STORAGE_KEY, 'system');
    events.emit(THEME_STORAGE_KEY, 'light', storage);

    expect(store.getPreference()).toBe('system');
  });

  it('returns to the default when another tab removes the value', () => {
    const storage = createFakeStorage({ initial: { [THEME_STORAGE_KEY]: 'dark' } });
    const { events, store } = createStore({ storage });

    storage.removeItem(THEME_STORAGE_KEY);
    events.emit(THEME_STORAGE_KEY, null, storage);

    expect(store.getPreference()).toBe('light');
  });

  it('returns to the default when another tab clears the storage', () => {
    const storage = createFakeStorage({ initial: { [THEME_STORAGE_KEY]: 'dark' } });
    const { events, store } = createStore({ storage });

    storage.clear();
    events.emit(null, null, storage);

    expect(store.getPreference()).toBe('light');
  });

  it('returns to the default when another tab writes a corrupted value', () => {
    const storage = createFakeStorage({ initial: { [THEME_STORAGE_KEY]: 'dark' } });
    const { events, store } = createStore({ storage });

    storage.setItem(THEME_STORAGE_KEY, 'purple');
    events.emit(THEME_STORAGE_KEY, 'purple', storage);

    expect(store.getPreference()).toBe('light');
  });

  it('ignores storage events about other keys', () => {
    const storage = createFakeStorage({ initial: { [THEME_STORAGE_KEY]: 'dark' } });
    const { events, store } = createStore({ storage });
    const listener = vi.fn();
    store.subscribe(listener);

    storage.setItem('acting-context', 'light');
    events.emit('acting-context', 'light', storage);

    expect(store.getPreference()).toBe('dark');
    expect(listener).not.toHaveBeenCalled();
  });

  it.each([
    { key: THEME_STORAGE_KEY, label: 'the theme key', newValue: 'light' },
    { key: null, label: 'a clear', newValue: null },
  ])('ignores $label of a foreign storage', ({ key, newValue }) => {
    const storage = createFakeStorage({ initial: { [THEME_STORAGE_KEY]: 'dark' } });
    const foreignStorage = createFakeStorage();
    const { events, store } = createStore({ storage });
    const listener = vi.fn();
    store.subscribe(listener);

    events.emit(key, newValue, foreignStorage);

    expect(store.getPreference()).toBe('dark');
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores events without a storage area', () => {
    const storage = createFakeStorage({ initial: { [THEME_STORAGE_KEY]: 'dark' } });
    const { events, store } = createStore({ storage });

    events.emit(THEME_STORAGE_KEY, 'light', null);

    expect(store.getPreference()).toBe('dark');
  });

  it('ignores every storage event when the device has no storage', () => {
    const { events, store } = createStore();
    const listener = vi.fn();
    store.setPreference('dark');
    store.subscribe(listener);

    events.emit(THEME_STORAGE_KEY, 'light', null);
    events.emit(null, null, null);

    expect(store.getPreference()).toBe('dark');
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops listening to the device and to the other tabs after dispose', () => {
    const storage = createFakeStorage();
    const { events, query, store } = createStore({ storage });
    const removeQueryListener = vi.spyOn(query, 'removeEventListener');
    const removeEventsListener = vi.spyOn(events, 'removeEventListener');
    const listener = vi.fn();
    store.setPreference('system');
    store.subscribe(listener);

    store.dispose();
    query.change(true);
    storage.setItem(THEME_STORAGE_KEY, 'dark');
    events.emit(THEME_STORAGE_KEY, 'dark', storage);

    expect(removeQueryListener).toHaveBeenCalledOnce();
    expect(removeEventsListener).toHaveBeenCalledOnce();
    expect(store.getResolvedTheme()).toBe('light');
    expect(store.getPreference()).toBe('system');
    expect(listener).not.toHaveBeenCalled();
  });
});
