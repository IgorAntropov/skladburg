import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadRequisitesPanel = createCachedModuleLoader(() => import('./panel/RequisitesPanel'));
