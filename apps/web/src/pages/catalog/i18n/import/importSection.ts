import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './ru';

export type ImportTranslate = SectionTranslate<typeof catalog>;

export const importSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./ru').then(loaded => loaded.catalog) },
  prefix: 'catalogImport',
});
