import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type CatalogEditorCatalogValue = typeof catalog;

export type CatalogEditorMessageKeyValue = Extract<keyof CatalogEditorCatalogValue, string>;

export type CatalogEditorTranslate = SectionTranslate<CatalogEditorCatalogValue>;

export const catalogEditorSection = createCatalogSection<CatalogEditorCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'catalogEditor',
});
