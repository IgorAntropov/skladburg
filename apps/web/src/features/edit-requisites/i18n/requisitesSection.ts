import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type RequisitesCatalogValue = typeof catalog;

export type RequisitesMessageKeyValue = Extract<keyof RequisitesCatalogValue, string>;

export type RequisitesTranslate = SectionTranslate<RequisitesCatalogValue>;

export const requisitesSection = createCatalogSection<RequisitesCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'requisites',
});
