import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadOwnCatalog = createCachedModuleLoader(() => import('./own/OwnCatalogPanel'));
