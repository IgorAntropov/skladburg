import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './catalogs/ru';

export type NotificationCatalogValue = typeof catalog;

export const notificationSection = createCatalogSection<NotificationCatalogValue>({
  loaders: { ru: () => import('./catalogs/ru').then(loaded => loaded.catalog) },
  prefix: 'notification',
});
