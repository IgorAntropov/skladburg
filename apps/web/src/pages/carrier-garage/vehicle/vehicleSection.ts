import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './ru';

export type VehicleTranslate = SectionTranslate<typeof catalog>;

export const vehicleSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./ru').then(loaded => loaded.catalog) },
  prefix: 'garageVehicle',
});
