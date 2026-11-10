import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadNetworkTripsList = createCachedModuleLoader(() => import('./NetworkTripsList'));
