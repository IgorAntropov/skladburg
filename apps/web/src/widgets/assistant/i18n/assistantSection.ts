import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type AssistantCatalogValue = typeof catalog;

export const assistantSection = createCatalogSection<AssistantCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'assistant',
});

export const assistantInformalSection = createCatalogSection<AssistantCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru.informal').then(loaded => loaded.catalog) },
  prefix: 'assistant',
});
