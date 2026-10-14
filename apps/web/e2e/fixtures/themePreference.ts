export type ColorSchemeValue = 'dark' | 'light';

const THEME_STORAGE_KEY = 'theme-preference';

const SYSTEM_THEME_PREFERENCE = 'system';

export const createStoreSystemThemeScript = (): string => (
  `window.localStorage.setItem(${JSON.stringify(THEME_STORAGE_KEY)}, ${JSON.stringify(SYSTEM_THEME_PREFERENCE)});`
);
