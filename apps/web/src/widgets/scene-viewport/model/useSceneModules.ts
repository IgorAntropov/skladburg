import {
  useEffect,
  useState,
} from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import type { SceneModuleValue } from './sceneViewportTypes';

import { loadSceneCameraControls } from '../lib/loadSceneCameraControls';
import { loadSceneRoot } from '../lib/loadSceneRoot';

export type SceneModulesStateValue<TData, TInteraction>
  = | { error: unknown; kind: 'failed' }
    | { kind: 'loaded'; rootModule: SceneRootModuleValue; sceneModule: SceneModuleValue<TData, TInteraction> }
    | { kind: 'loading' };

type SceneRootModuleValue = Awaited<ReturnType<typeof loadSceneRoot>>;

const LOADING_STATE = { kind: 'loading' } as const;

const peekModules = <TData, TInteraction>(
  loadScene: CachedModuleLoader<SceneModuleValue<TData, TInteraction>>,
): SceneModulesStateValue<TData, TInteraction> => {
  const rootModule = loadSceneRoot.peekLoadedModule();
  const sceneModule = loadScene.peekLoadedModule();

  if (rootModule === undefined || sceneModule === undefined) {
    return LOADING_STATE;
  }

  return { kind: 'loaded', rootModule, sceneModule };
};

export const useSceneModules = <TData, TInteraction>(
  loadScene: CachedModuleLoader<SceneModuleValue<TData, TInteraction>>,
): SceneModulesStateValue<TData, TInteraction> => {
  const [modulesState, setModulesState] = useState<SceneModulesStateValue<TData, TInteraction>>(() => peekModules(loadScene));

  const isLoading = modulesState.kind === 'loading';

  useEffect(() => {
    if (!isLoading) {
      return undefined;
    }

    let isCancelled = false;

    loadSceneCameraControls().catch((error: unknown) => {
      console.log('> useSceneModules -> warmCameraControls:', { error });
    });

    Promise.all([loadSceneRoot(), loadScene()]).then(
      ([rootModule, sceneModule]) => {
        if (!isCancelled) {
          setModulesState({ kind: 'loaded', rootModule, sceneModule });
        }
      },
      (error: unknown) => {
        if (!isCancelled) {
          setModulesState({ error, kind: 'failed' });
        }
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [isLoading, loadScene]);

  return modulesState;
};
