import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { garageCatalog } from './ru';

export type GarageTranslate = SectionTranslate<typeof garageCatalog>;

export const garageSection = createCatalogSection<typeof garageCatalog>({
  loaders: { ru: () => import('./ru').then(module => module.garageCatalog) },
  prefix: 'garage',
});
