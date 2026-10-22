import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadProfileMyProfile = createCachedModuleLoader(() => import('./my-profile/ProfileMyProfile'));
