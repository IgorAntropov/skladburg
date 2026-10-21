import type { NetworkMapModelValue } from '@/entities/network';
import type { SceneModuleValue } from '@/widgets/scene-viewport';

import { createCachedModuleLoader } from '@/shared/lib/module-loader';

import type { NetworkSceneInteractionValue } from '../model/networkSceneInteraction';

export const loadNetworkScene = createCachedModuleLoader<SceneModuleValue<NetworkMapModelValue, NetworkSceneInteractionValue | undefined>>(
  () => import('../scene/NetworkWorldScene'),
);
