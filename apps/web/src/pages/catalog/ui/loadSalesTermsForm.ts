import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadSalesTermsForm = createCachedModuleLoader(() => import('./sales-terms/SalesTermsForm'));
