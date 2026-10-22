import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadOrganizationInspector = createCachedModuleLoader(() => import('./organization-card/OrganizationInspector'));
