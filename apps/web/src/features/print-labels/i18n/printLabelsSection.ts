import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './ru';

export const printLabelsSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./ru').then(module => module.catalog) },
  prefix: 'printLabels',
});
