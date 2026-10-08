import type { ThemePreferenceValue } from './themeTypes';

export const THEME_STORAGE_KEY = 'theme-preference';

export const DEFAULT_THEME_PREFERENCE: ThemePreferenceValue = 'light';

export const parseThemePreference = (value: unknown): ThemePreferenceValue | undefined => {
  return value === 'dark' || value === 'light' || value === 'system' ? value : undefined;
};

export const getDeviceStorage = (target: Pick<Window, 'localStorage'>): Storage | undefined => {
  try {
    return target.localStorage;
  }
  catch (error: unknown) {
    console.error('> themePersistence -> getDeviceStorage:', { error });

    return undefined;
  }
};

export const readStoredThemePreference = (storage: Storage | undefined): ThemePreferenceValue | undefined => {
  if (storage === undefined) {
    return undefined;
  }

  try {
    return parseThemePreference(storage.getItem(THEME_STORAGE_KEY));
  }
  catch (error: unknown) {
    console.error('> themePersistence -> readStoredThemePreference:', { error });

    return undefined;
  }
};

export const writeStoredThemePreference = (storage: Storage | undefined, preference: ThemePreferenceValue): void => {
  if (storage === undefined) {
    return;
  }

  try {
    storage.setItem(THEME_STORAGE_KEY, preference);
  }
  catch (error: unknown) {
    console.error('> themePersistence -> writeStoredThemePreference:', { error, preference });
  }
};
