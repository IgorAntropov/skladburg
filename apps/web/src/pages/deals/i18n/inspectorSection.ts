import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/inspectorRu';

export type DealInspectorTranslate = SectionTranslate<typeof catalog>;

export const dealInspectorSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./catalogs/inspectorRu').then(loaded => loaded.catalog) },
  prefix: 'dealInspector',
});
