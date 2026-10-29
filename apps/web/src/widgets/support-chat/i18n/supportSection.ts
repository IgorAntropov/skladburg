import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type SupportCatalogValue = typeof catalog;

export const supportSection = createCatalogSection<SupportCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'support',
});

export const supportInformalSection = createCatalogSection<SupportCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru.informal').then(loaded => loaded.catalog) },
  prefix: 'support',
});
