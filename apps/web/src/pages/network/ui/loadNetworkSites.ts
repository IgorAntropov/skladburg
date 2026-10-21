import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadNetworkSites = createCachedModuleLoader(() => import('./sites/NetworkSitesPanel'));
