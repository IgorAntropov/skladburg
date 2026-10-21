import type { NetworkMapModelValue } from '@/entities/network';
import type { SceneModuleValue } from '@/widgets/scene-viewport';

import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadNetworkScene = createCachedModuleLoader<SceneModuleValue<NetworkMapModelValue>>(
  () => import('../scene/NetworkWorldScene'),
);
