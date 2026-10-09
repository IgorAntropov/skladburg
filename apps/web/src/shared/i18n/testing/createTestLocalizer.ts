import { defaultLocaleCatalog } from 'virtual:build-profile';

import type { ILocalizer } from '../localizer/localizationTypes';

import { createLocalizer } from '../localizer/createLocalizer';

export const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});
