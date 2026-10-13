import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadNetworkScene = createCachedModuleLoader(() => import('../scene/NetworkWorldScene'));
