import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './dealTransportRu';

export type DealTransportTranslate = SectionTranslate<typeof catalog>;

export const dealTransportSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./dealTransportRu').then(loaded => loaded.catalog) },
  prefix: 'dealTransport',
});
