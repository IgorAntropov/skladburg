import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type DealsMessageKeyValue = keyof DealsCatalogValue;

export type DealsTranslate = SectionTranslate<DealsCatalogValue>;
type DealsCatalogValue = typeof catalog;

export const dealsSection = createCatalogSection<DealsCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'deals',
});
