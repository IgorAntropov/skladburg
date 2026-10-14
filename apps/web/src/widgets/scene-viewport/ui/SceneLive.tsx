import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
  useReducer,
} from 'react';

import type {
  QualityLevelValue,
  ShadowMapSizeValue,
} from '@/shared/3d';
import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import { useSceneSettingsStore } from '@/features/scene-settings';
import { useI18n } from '@/shared/i18n';
import { useDelayedVisibility } from '@/shared/ui';

import type { SceneViewportPhaseValue } from '../model/sceneViewportMachine';
import type { SceneModuleValue } from '../model/sceneViewportTypes';
import type { SceneStateValue } from './SceneFrame';

import {
  INITIAL_SCENE_VIEWPORT_STATE,
  reduceSceneViewport,
} from '../model/sceneViewportMachine';
import { useSceneCameraStore } from '../model/useSceneCameraStore';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { SceneErrorPlaceholder } from './SceneErrorPlaceholder';
import { SceneFrame } from './SceneFrame';
import { SceneLayer } from './SceneLayer';
import { SceneOffPlaceholder } from './SceneOffPlaceholder';
import { ScenePlaceholder } from './ScenePlaceholder';
import { SceneStage } from './SceneStage';

interface SceneLiveProps {
  autoCeiling: QualityLevelValue | undefined;
  dprCeiling: number;
  isStatsShown: boolean;
  label: string;
  level: QualityLevelValue;
  loadScene: CachedModuleLoader<SceneModuleValue>;
  shadowMapSize: ShadowMapSizeValue;
}

const SCENE_STATE_BY_PHASE = {
  error: 'error',
  loading: 'loading',
  ready: 'ready',
  unavailable: 'off',
} as const satisfies Record<SceneViewportPhaseValue, SceneStateValue>;

export const SceneLive = ({
  autoCeiling,
  dprCeiling,
  isStatsShown,
  label,
  level,
  loadScene,
  shadowMapSize,
}: SceneLiveProps): ReactElement => {
  const { t } = useI18n();
  const autoLevelChangeCount = useSceneSettingsStore(state => state.autoLevelChangeCount);
  const markSceneUnavailable = useSceneSettingsStore(state => state.markSceneUnavailable);
  const reportAutoLevel = useSceneSettingsStore(state => state.reportAutoLevel);
  const setCameraReady = useSceneCameraStore(state => state.setCameraReady);
  const [state, dispatch] = useReducer(reduceSceneViewport, INITIAL_SCENE_VIEWPORT_STATE);

  const autoQuality = useMemo(
    () => autoCeiling === undefined ? undefined : { ceiling: autoCeiling, changeCount: autoLevelChangeCount },
    [autoCeiling, autoLevelChangeCount],
  );

  const isLoading = state.phase === 'loading';
  const isLoadingPlaceholderShown = useDelayedVisibility(isLoading);
  const isStageMounted = isLoading || state.phase === 'ready';
  const isErrorShown = state.phase === 'error';
  const isUnavailableShown = state.phase === 'unavailable';
  const isSceneReady = state.phase === 'ready';

  const handleSceneReady = (): void => {
    console.log('> SceneLive -> handleSceneReady:', { attempt: state.attempt });
    dispatch({ kind: 'ready' });
  };

  const handleSceneFailure = (error: unknown): void => {
    console.error('> SceneLive -> handleSceneFailure:', { attempt: state.attempt, error });
    dispatch({ error, kind: 'failed' });
  };

  const handleAutoLevelChange = (nextLevel: QualityLevelValue): void => {
    console.log('> SceneLive -> handleAutoLevelChange:', { attempt: state.attempt, nextLevel });
    reportAutoLevel(nextLevel, 'measured');
  };

  const handleContextLost = (): void => {
    console.log('> SceneLive -> handleContextLost:', { attempt: state.attempt });
    dispatch({ kind: 'contextLost' });
  };

  const handleRetry = (): void => {
    console.log('> SceneLive -> handleRetry:', { attempt: state.attempt });
    dispatch({ kind: 'retry' });
  };

  useEffect(() => {
    if (isUnavailableShown) {
      console.log('> SceneLive -> markSceneUnavailable:', { attempt: state.attempt });
      markSceneUnavailable();
    }
  }, [isUnavailableShown, markSceneUnavailable, state.attempt]);

  useEffect(() => {
    if (!isSceneReady) {
      return undefined;
    }

    console.log('> SceneLive -> setCameraReady:', { attempt: state.attempt });
    setCameraReady(true);

    return () => {
      setCameraReady(false);
    };
  }, [isSceneReady, setCameraReady, state.attempt]);

  return (
    <SceneFrame sceneState={SCENE_STATE_BY_PHASE[state.phase]}>
      {isStageMounted && (
        <SceneErrorBoundary key={state.attempt} onError={handleSceneFailure}>
          <SceneStage
            autoQuality={autoQuality}
            dprCeiling={dprCeiling}
            isStatsShown={isStatsShown}
            level={level}
            loadScene={loadScene}
            onAutoLevelChange={handleAutoLevelChange}
            onContextLost={handleContextLost}
            onReady={handleSceneReady}
            shadowMapSize={shadowMapSize}
          />
        </SceneErrorBoundary>
      )}
      {isLoadingPlaceholderShown && (
        <SceneLayer>
          <ScenePlaceholder isLoading label={t('scene.loading')} role="status" />
        </SceneLayer>
      )}
      {isErrorShown && (
        <SceneLayer>
          <SceneErrorPlaceholder onRetry={handleRetry} recovery={state.recovery} />
        </SceneLayer>
      )}
      {isUnavailableShown && (
        <SceneLayer>
          <SceneOffPlaceholder label={label} reason="noWebGl" />
        </SceneLayer>
      )}
    </SceneFrame>
  );
};
