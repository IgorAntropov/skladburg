import type { ReactElement } from 'react';

import {
  useCallback,
  useMemo,
  useRef,
} from 'react';

import type {
  AutoQualitySettingsValue,
  QualityLevelValue,
  ShadowMapSizeValue,
} from '@/shared/3d';
import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import { useSceneInsets } from '@/shared/lib/viewport';
import { useResolvedTheme } from '@/shared/theme';

import type { SceneModuleValue } from '../model/sceneViewportTypes';

import { subscribeToSceneCameraCommands } from '../model/subscribeToSceneCameraCommands';
import { usePrefersReducedMotion } from '../model/usePrefersReducedMotion';
import { usePreparedSceneData } from '../model/usePreparedSceneData';
import { useSceneModules } from '../model/useSceneModules';
import { SceneLayer } from './SceneLayer';

interface SceneStageProps<TData, TInteraction> {
  autoQuality: AutoQualitySettingsValue | undefined;
  dprCeiling: number;
  interaction: TInteraction;
  isStatsShown: boolean;
  level: QualityLevelValue;
  loadScene: CachedModuleLoader<SceneModuleValue<TData, TInteraction>>;
  onAutoLevelChange: (level: QualityLevelValue) => void;
  onContextLost: () => void;
  onReady: () => void;
  sceneData: TData | undefined;
  shadowMapSize: ShadowMapSizeValue;
}

const STAGE_LAYER_CLASS_NAME = [
  'opacity-0 group-data-[scene-state=ready]:opacity-100',
  'motion-safe:transition-opacity motion-safe:duration-(--duration-panel) motion-safe:ease-out',
].join(' ');

const JUMP_FADE_KEYFRAMES: Keyframe[] = [{ opacity: 0.3 }, { opacity: 1 }];
const JUMP_FADE_DURATION_MS = 150;

const JUMP_FADE_LAYER_CLASS_NAME = 'absolute inset-0';

export const SceneStage = <TData, TInteraction>({
  autoQuality,
  dprCeiling,
  interaction,
  isStatsShown,
  level,
  loadScene,
  onAutoLevelChange,
  onContextLost,
  onReady,
  sceneData,
  shadowMapSize,
}: SceneStageProps<TData, TInteraction>): null | ReactElement => {
  const modulesState = useSceneModules(loadScene);
  const loadedSceneModule = modulesState.kind === 'failed' ? undefined : modulesState.sceneModule;
  const preparedState = usePreparedSceneData(loadedSceneModule, sceneData);
  const preparedData = preparedState.kind === 'ready' ? preparedState.data : undefined;
  const isReducedMotion = usePrefersReducedMotion();
  const resolvedTheme = useResolvedTheme();
  const focusInsets = useSceneInsets();
  const jumpFadeLayerRef = useRef<HTMLDivElement>(null);

  const handleCameraJump = useCallback((): void => {
    console.log('> SceneStage -> handleCameraJump:', { durationMs: JUMP_FADE_DURATION_MS });
    jumpFadeLayerRef.current?.animate(JUMP_FADE_KEYFRAMES, {
      duration: JUMP_FADE_DURATION_MS,
      easing: 'ease-out',
    });
  }, []);

  const world = useMemo(
    () => loadedSceneModule === undefined || preparedData === undefined
      ? undefined
      : loadedSceneModule.resolveWorld(preparedData),
    [loadedSceneModule, preparedData],
  );

  if (modulesState.kind === 'failed') {
    throw modulesState.error;
  }

  if (preparedState.kind === 'failed') {
    throw preparedState.error;
  }

  if (modulesState.kind !== 'loaded' || preparedState.kind === 'pending' || world === undefined) {
    return null;
  }

  const isNight = resolvedTheme === 'dark';
  const { rootModule, sceneModule } = modulesState;
  const SceneRoot = rootModule.default;
  const SceneContent = sceneModule.default;

  return (
    <SceneLayer className={STAGE_LAYER_CLASS_NAME}>
      <div aria-hidden className={JUMP_FADE_LAYER_CLASS_NAME} ref={jumpFadeLayerRef}>
        <SceneRoot
          autoQuality={autoQuality}
          content={<SceneContent data={preparedState.data} interaction={interaction} level={level} />}
          dprCeiling={dprCeiling}
          focusInsets={focusInsets}
          isNight={isNight}
          isReducedMotion={isReducedMotion}
          isStatsShown={isStatsShown}
          level={level}
          onAutoLevelChange={onAutoLevelChange}
          onCameraJump={handleCameraJump}
          onContextLost={onContextLost}
          onReady={onReady}
          shadowMapSize={shadowMapSize}
          subscribeToCameraCommands={subscribeToSceneCameraCommands}
          world={world}
        />
      </div>
    </SceneLayer>
  );
};
