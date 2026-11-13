import type { SectionTranslate } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './dealReceiptRu';

export type DealReceiptTranslate = SectionTranslate<typeof catalog>;

export const dealReceiptSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./dealReceiptRu').then(module => module.catalog) },
  prefix: 'dealReceipt',
});
