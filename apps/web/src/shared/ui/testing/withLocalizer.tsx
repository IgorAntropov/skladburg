import type { ReactElement } from 'react';

import { defaultLocaleCatalog } from 'virtual:build-profile';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';

const localizer = await createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

export const withLocalizer = (node: ReactElement): ReactElement => {
  return <LocalizerProvider localizer={localizer}>{node}</LocalizerProvider>;
};
