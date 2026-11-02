import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type CatalogPageCatalogValue = typeof catalog;

export type CatalogPageMessageKeyValue = Extract<keyof CatalogPageCatalogValue, string>;

export type CatalogPageTranslate = SectionTranslate<CatalogPageCatalogValue>;

export const catalogSection = createCatalogSection<CatalogPageCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'catalog',
});
