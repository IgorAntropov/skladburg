import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadOrganizationDirectoryPanel = createCachedModuleLoader(() => import('./directory/OrganizationDirectoryPanel'));
