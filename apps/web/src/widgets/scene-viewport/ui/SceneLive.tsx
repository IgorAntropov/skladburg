import type { ReactElement } from 'react';

import {
  useEffect,
  useReducer,
} from 'react';

import type { QualityLevelValue } from '@/shared/3d';
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
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { SceneErrorPlaceholder } from './SceneErrorPlaceholder';
import { SceneFrame } from './SceneFrame';
import { SceneLayer } from './SceneLayer';
import { SceneOffPlaceholder } from './SceneOffPlaceholder';
import { ScenePlaceholder } from './ScenePlaceholder';
import { SceneStage } from './SceneStage';

interface SceneLiveProps {
  dprCeiling: number;
  isStatsShown: boolean;
  label: string;
  level: QualityLevelValue;
  loadScene: CachedModuleLoader<SceneModuleValue>;
}

const SCENE_STATE_BY_PHASE = {
  error: 'error',
  loading: 'loading',
  ready: 'ready',
  unavailable: 'off',
} as const satisfies Record<SceneViewportPhaseValue, SceneStateValue>;

export const SceneLive = ({
  dprCeiling,
  isStatsShown,
  label,
  level,
  loadScene,
}: SceneLiveProps): ReactElement => {
  const { t } = useI18n();
  const markSceneUnavailable = useSceneSettingsStore(state => state.markSceneUnavailable);
  const [state, dispatch] = useReducer(reduceSceneViewport, INITIAL_SCENE_VIEWPORT_STATE);

  const isLoading = state.phase === 'loading';
  const isLoadingPlaceholderShown = useDelayedVisibility(isLoading);
  const isStageMounted = isLoading || state.phase === 'ready';
  const isErrorShown = state.phase === 'error';
  const isUnavailableShown = state.phase === 'unavailable';

  const handleSceneReady = (): void => {
    console.log('> SceneLive -> handleSceneReady:', { attempt: state.attempt });
    dispatch({ kind: 'ready' });
  };

  const handleSceneFailure = (error: unknown): void => {
    console.error('> SceneLive -> handleSceneFailure:', { attempt: state.attempt, error });
    dispatch({ error, kind: 'failed' });
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

  return (
    <SceneFrame sceneState={SCENE_STATE_BY_PHASE[state.phase]}>
      {isStageMounted && (
        <SceneErrorBoundary onError={handleSceneFailure}>
          <SceneStage
            dprCeiling={dprCeiling}
            isStatsShown={isStatsShown}
            level={level}
            loadScene={loadScene}
            onReady={handleSceneReady}
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
