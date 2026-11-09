import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type RecordsTranslate = SectionTranslate<typeof catalog>;

export const recordsSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'garageRecords',
});
