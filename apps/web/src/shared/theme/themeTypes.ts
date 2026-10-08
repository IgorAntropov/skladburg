export interface CreateThemePreferenceStoreOptionsValue {
  colorSchemeQuery: MediaQueryList | undefined;
  storage: Storage | undefined;
  storageEvents: Pick<Window, 'addEventListener' | 'removeEventListener'> | undefined;
}

export interface IThemePreferenceStore {
  dispose: () => void;
  getPreference: () => ThemePreferenceValue;
  getResolvedTheme: () => ResolvedThemeValue;
  setPreference: (preference: ThemePreferenceValue) => void;
  subscribe: (listener: () => void) => () => void;
}

export type ResolvedThemeValue = 'dark' | 'light';

export interface ThemePreferenceHandleValue {
  preference: ThemePreferenceValue;
  resolvedTheme: ResolvedThemeValue;
  setPreference: (preference: ThemePreferenceValue) => void;
}

export type ThemePreferenceValue = 'dark' | 'light' | 'system';
