import type { ReactElement } from 'react';

import {
  useCallback,
  useRef,
} from 'react';

import type { QualityLevelValue } from '@/shared/3d';
import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import { useSceneInsets } from '@/shared/lib/viewport';

import type { SceneModuleValue } from '../model/sceneViewportTypes';

import { subscribeToSceneCameraCommands } from '../model/subscribeToSceneCameraCommands';
import { usePrefersReducedMotion } from '../model/usePrefersReducedMotion';
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

const JUMP_FADE_KEYFRAMES: Keyframe[] = [{ opacity: 0.3 }, { opacity: 1 }];
const JUMP_FADE_DURATION_MS = 150;

const JUMP_FADE_LAYER_CLASS_NAME = 'absolute inset-0';

export const SceneStage = ({
  dprCeiling,
  isStatsShown,
  level,
  loadScene,
  onReady,
}: SceneStageProps): null | ReactElement => {
  const modulesState = useSceneModules(loadScene);
  const isReducedMotion = usePrefersReducedMotion();
  const focusInsets = useSceneInsets();
  const jumpFadeLayerRef = useRef<HTMLDivElement>(null);

  const handleCameraJump = useCallback((): void => {
    console.log('> SceneStage -> handleCameraJump:', { durationMs: JUMP_FADE_DURATION_MS });
    jumpFadeLayerRef.current?.animate(JUMP_FADE_KEYFRAMES, {
      duration: JUMP_FADE_DURATION_MS,
      easing: 'ease-out',
    });
  }, []);

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
      <div className={JUMP_FADE_LAYER_CLASS_NAME} ref={jumpFadeLayerRef}>
        <SceneRoot
          Content={sceneModule.default}
          dprCeiling={dprCeiling}
          focusInsets={focusInsets}
          isReducedMotion={isReducedMotion}
          isStatsShown={isStatsShown}
          level={level}
          onCameraJump={handleCameraJump}
          onReady={onReady}
          subscribeToCameraCommands={subscribeToSceneCameraCommands}
          world={sceneModule.world}
        />
      </div>
    </SceneLayer>
  );
};
