import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadSceneCameraControls = createCachedModuleLoader(() => import('../ui/controls/SceneCameraControlsPanel'));
