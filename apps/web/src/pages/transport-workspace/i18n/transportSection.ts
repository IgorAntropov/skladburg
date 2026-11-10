import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { transportCatalog } from './ru';

export type TransportTranslate = SectionTranslate<typeof transportCatalog>;

export const transportSection = createCatalogSection<typeof transportCatalog>({
  loaders: { ru: () => import('./ru').then(module => module.transportCatalog) },
  prefix: 'transport',
});
