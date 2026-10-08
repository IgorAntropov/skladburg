import { createContext } from 'react';

import type { IThemePreferenceStore } from './themeTypes';

export const ThemePreferenceContext = createContext<IThemePreferenceStore | undefined>(undefined);
