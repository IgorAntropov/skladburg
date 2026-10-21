import type { ReactElement } from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import { useViewportClass } from '@/shared/lib/viewport';
import { useAddress } from '@/shared/routing';

import type { SceneModuleValue } from '../model/sceneViewportTypes';

import { readIsStatsShown } from '../lib/readIsStatsShown';
import { SCENE_DPR_CEILING } from '../lib/sceneDprCeiling';
import { SCENE_SHADOW_MAP_SIZE } from '../lib/sceneShadowMapSize';
import { useSceneMode } from '../model/useSceneMode';
import { SceneFrame } from './SceneFrame';
import { SceneLayer } from './SceneLayer';
import { SceneLive } from './SceneLive';
import { SceneOffPlaceholder } from './SceneOffPlaceholder';

interface SceneViewportProps<TData, TInteraction> {
  interaction: TInteraction;
  label: string;
  loadScene: CachedModuleLoader<SceneModuleValue<TData, TInteraction>>;
  sceneData: TData | undefined;
}

export const SceneViewport = <TData, TInteraction>({
  interaction,
  label,
  loadScene,
  sceneData,
}: SceneViewportProps<TData, TInteraction>): ReactElement => {
  const viewportClass = useViewportClass();
  const mode = useSceneMode(viewportClass);
  const { searchParams } = useAddress();

  const isStatsShown = readIsStatsShown(searchParams, import.meta.env.DEV);

  if (mode.kind === 'off') {
    return (
      <SceneFrame sceneState="off">
        <SceneLayer>
          <SceneOffPlaceholder label={label} reason={mode.reason} />
        </SceneLayer>
      </SceneFrame>
    );
  }

  return (
    <SceneLive
      autoCeiling={mode.isAuto ? mode.autoCeiling : undefined}
      dprCeiling={SCENE_DPR_CEILING[viewportClass]}
      interaction={interaction}
      isStatsShown={isStatsShown}
      label={label}
      level={mode.level}
      loadScene={loadScene}
      sceneData={sceneData}
      shadowMapSize={SCENE_SHADOW_MAP_SIZE[viewportClass]}
    />
  );
};
