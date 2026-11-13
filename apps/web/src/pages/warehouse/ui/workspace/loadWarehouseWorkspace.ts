import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadWarehouseWorkspace = createCachedModuleLoader(() => import('./WarehouseWorkspaceRoute').then(module => ({
  default: module.WarehouseWorkspaceRoute,
})));
