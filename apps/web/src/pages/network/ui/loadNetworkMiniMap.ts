import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadNetworkMiniMap = createCachedModuleLoader(() => import('./mini-map/NetworkMiniMap'));
