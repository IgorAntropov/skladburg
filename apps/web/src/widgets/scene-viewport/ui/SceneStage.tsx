import type { ReactElement } from 'react';

import type { QualityLevelValue } from '@/shared/3d';
import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import type { SceneModuleValue } from '../model/sceneViewportTypes';

import { useSceneModules } from '../model/useSceneModules';
import { SceneLayer } from './SceneLayer';

interface SceneStageProps {
  dprCeiling: number;
  isStatsShown: boolean;
  level: QualityLevelValue;
  loadScene: CachedModuleLoader<SceneModuleValue>;
  onReady: () => void;
}

const STAGE_LAYER_CLASS_NAME = [
  'opacity-0 group-data-[scene-state=ready]:opacity-100',
  'motion-safe:transition-opacity motion-safe:duration-(--duration-panel) motion-safe:ease-out',
].join(' ');

export const SceneStage = ({
  dprCeiling,
  isStatsShown,
  level,
  loadScene,
  onReady,
}: SceneStageProps): null | ReactElement => {
  const modulesState = useSceneModules(loadScene);

  if (modulesState.kind === 'failed') {
    throw modulesState.error;
  }

  if (modulesState.kind === 'loading') {
    return null;
  }

  const { rootModule, sceneModule } = modulesState;
  const SceneRoot = rootModule.default;

  return (
    <SceneLayer className={STAGE_LAYER_CLASS_NAME}>
      <SceneRoot
        bounds={sceneModule.bounds}
        Content={sceneModule.default}
        dprCeiling={dprCeiling}
        isStatsShown={isStatsShown}
        level={level}
        onReady={onReady}
      />
    </SceneLayer>
  );
};
