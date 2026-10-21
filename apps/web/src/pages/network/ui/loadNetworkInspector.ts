import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadNetworkInspector = createCachedModuleLoader(() => import('./inspector/NetworkInspectorBody'));
