import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './documentRu';

export type DealDocumentTranslate = SectionTranslate<typeof catalog>;

export const dealDocumentSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./documentRu').then(loaded => loaded.catalog) },
  prefix: 'dealDocument',
});
