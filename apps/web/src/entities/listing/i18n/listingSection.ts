import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type ListingCatalogValue = typeof catalog;

export type ListingMessageKeyValue = Extract<keyof ListingCatalogValue, string>;

export type ListingTranslate = SectionTranslate<ListingCatalogValue>;

export const listingSection = createCatalogSection<ListingCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'listing',
});
