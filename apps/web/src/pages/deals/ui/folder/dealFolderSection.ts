import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './dealFolderRu';

export type DealFolderTranslate = SectionTranslate<typeof catalog>;

export const dealFolderSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./dealFolderRu').then(loaded => loaded.catalog) },
  prefix: 'dealFolder',
});
