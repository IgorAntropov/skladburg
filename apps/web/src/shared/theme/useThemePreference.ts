import {
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import type {
  IThemePreferenceStore,
  ThemePreferenceHandleValue,
} from './themeTypes';

import { ThemePreferenceContext } from './ThemePreferenceContext';

const useThemePreferenceStore = (): IThemePreferenceStore => {
  const store = useContext(ThemePreferenceContext);

  if (store === undefined) {
    throw new Error('useThemePreference must be used inside ThemePreferenceProvider');
  }

  return store;
};

export const useThemePreference = (): ThemePreferenceHandleValue => {
  const store = useThemePreferenceStore();
  const preference = useSyncExternalStore(store.subscribe, store.getPreference);
  const resolvedTheme = useSyncExternalStore(store.subscribe, store.getResolvedTheme);

  return useMemo(
    (): ThemePreferenceHandleValue => ({ preference, resolvedTheme, setPreference: store.setPreference }),
    [preference, resolvedTheme, store.setPreference],
  );
};
