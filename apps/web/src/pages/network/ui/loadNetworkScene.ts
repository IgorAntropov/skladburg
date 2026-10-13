import type { SceneModuleValue } from '@/widgets/scene-viewport';

import { createCachedModuleLoader } from '@/shared/lib/module-loader';

const importPreparedScene = async (): Promise<SceneModuleValue> => {
  const sceneModule = await import('../scene/NetworkWorldScene');

  await sceneModule.prepare();

  return sceneModule;
};

export const loadNetworkScene = createCachedModuleLoader(importPreparedScene);
