import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './workspaceRu';

export type WarehouseWorkTranslate = SectionTranslate<typeof catalog>;

export const warehouseWorkSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./workspaceRu').then(module => module.catalog) },
  prefix: 'warehouseWork',
});
