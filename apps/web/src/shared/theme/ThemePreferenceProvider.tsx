import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { IThemePreferenceStore } from './themeTypes';

import { ThemePreferenceContext } from './ThemePreferenceContext';

interface ThemePreferenceProviderProps {
  children: ReactNode;
  store: IThemePreferenceStore;
}

export const ThemePreferenceProvider = ({ children, store }: ThemePreferenceProviderProps): ReactElement => {
  return <ThemePreferenceContext value={store}>{children}</ThemePreferenceContext>;
};
