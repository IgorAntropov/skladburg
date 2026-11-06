import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadImportPanel = createCachedModuleLoader(() => import('./import/ImportPanel'));
