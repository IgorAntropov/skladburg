import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './warehouseStaffRu';

export type WarehouseStaffTranslate = SectionTranslate<typeof catalog>;

export const warehouseStaffSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./warehouseStaffRu').then(module => module.catalog) },
  prefix: 'warehouseStaff',
});
