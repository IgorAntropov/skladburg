import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type DocumentTypeKeyValue = Exclude<keyof typeof catalog, 'documentType.dealReference'>;

export type DocumentTypeTranslate = SectionTranslate<typeof catalog>;

export const documentTypeSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'documentType',
});
