export interface ThemeBootScriptOptionsValue {
  darkQuery: string;
  defaultPreference: string;
  storageKey: string;
  themeColors: Readonly<Record<'dark' | 'light', string>>;
}
