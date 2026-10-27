import { createCachedModuleLoader } from '@/shared/lib/module-loader';

import { createAppUpdateNotice } from './createAppUpdateNotice';

export const AppUpdateNotice = createAppUpdateNotice(
  createCachedModuleLoader(() => import('./AppUpdateNoticePanel').then(module => ({ default: module.AppUpdateNoticePanel }))),
);
