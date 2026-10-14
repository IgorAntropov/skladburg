export const THEME_STORAGE_KEY = 'theme-preference';

export const DARK_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export const DEFAULT_THEME_PREFERENCE = 'light';

export const THEME_COLOR_BY_THEME: Readonly<Record<'dark' | 'light', string>> = {
  dark: '#1e2a4a',
  light: '#ffffff',
};

export const MANIFEST_BACKGROUND_COLOR = '#edeae3';
