import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadNetworkCompanies = createCachedModuleLoader(() => import('./companies/NetworkCompaniesPanel'));
