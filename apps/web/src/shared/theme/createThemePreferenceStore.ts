import type {
  CreateThemePreferenceStoreOptionsValue,
  IThemePreferenceStore,
  ResolvedThemeValue,
  ThemePreferenceValue,
} from './themeTypes';

import {
  DEFAULT_THEME_PREFERENCE,
  readStoredThemePreference,
  THEME_STORAGE_KEY,
  writeStoredThemePreference,
} from './themePersistence';

const resolveTheme = (preference: ThemePreferenceValue, colorSchemeQuery: MediaQueryList | undefined): ResolvedThemeValue => {
  if (preference === 'system') {
    return colorSchemeQuery?.matches === true ? 'dark' : 'light';
  }

  return preference;
};

export const createThemePreferenceStore = ({
  colorSchemeQuery,
  storage,
  storageEvents,
}: CreateThemePreferenceStoreOptionsValue): IThemePreferenceStore => {
  let preference = readStoredThemePreference(storage) ?? DEFAULT_THEME_PREFERENCE;
  let resolvedTheme = resolveTheme(preference, colorSchemeQuery);
  const listeners = new Set<() => void>();

  const apply = (nextPreference: ThemePreferenceValue): void => {
    const nextResolvedTheme = resolveTheme(nextPreference, colorSchemeQuery);
    const isChanged = nextPreference !== preference || nextResolvedTheme !== resolvedTheme;

    preference = nextPreference;
    resolvedTheme = nextResolvedTheme;

    if (!isChanged) {
      return;
    }

    for (const listener of [...listeners]) {
      listener();
    }
  };

  const handleColorSchemeChange = (): void => {
    apply(preference);
  };

  const handleStorageEvent = (event: StorageEvent): void => {
    const isOwnStorage = storage !== undefined && event.storageArea === storage;
    const isOwnKeyOrClear = event.key === null || event.key === THEME_STORAGE_KEY;

    if (!isOwnStorage || !isOwnKeyOrClear) {
      return;
    }

    apply(readStoredThemePreference(storage) ?? DEFAULT_THEME_PREFERENCE);
  };

  colorSchemeQuery?.addEventListener('change', handleColorSchemeChange);
  storageEvents?.addEventListener('storage', handleStorageEvent);

  return {
    dispose: () => {
      colorSchemeQuery?.removeEventListener('change', handleColorSchemeChange);
      storageEvents?.removeEventListener('storage', handleStorageEvent);
      listeners.clear();
    },
    getPreference: () => preference,
    getResolvedTheme: () => resolvedTheme,
    setPreference: (nextPreference) => {
      if (nextPreference === preference) {
        return;
      }

      writeStoredThemePreference(storage, nextPreference);
      apply(nextPreference);
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
