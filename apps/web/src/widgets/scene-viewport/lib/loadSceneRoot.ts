import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadSceneRoot = createCachedModuleLoader(() => import('../scene/SceneRoot'));
