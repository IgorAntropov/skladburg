import type { IThemePreferenceStore } from '@/shared/theme';

import { createThemePreferenceStore } from '@/shared/theme';

export const createTestThemeStore = (): IThemePreferenceStore => createThemePreferenceStore({
  colorSchemeQuery: undefined,
  storage: undefined,
  storageEvents: undefined,
});
