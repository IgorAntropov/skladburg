import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadWarehouseImportPanel = createCachedModuleLoader(() => import('./import/WarehouseImportPanel'));
