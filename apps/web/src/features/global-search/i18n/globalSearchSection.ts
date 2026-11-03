import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type GlobalSearchCatalogValue = typeof catalog;

export type GlobalSearchMessageKeyValue = Extract<keyof GlobalSearchCatalogValue, string>;

export type GlobalSearchTranslate = SectionTranslate<GlobalSearchCatalogValue>;

export const globalSearchSection = createCatalogSection<GlobalSearchCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'globalSearch',
});
