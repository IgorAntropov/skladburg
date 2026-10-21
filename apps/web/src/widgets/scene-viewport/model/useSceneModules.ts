import {
  useEffect,
  useState,
} from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import type { SceneModuleValue } from './sceneViewportTypes';

import { loadSceneCameraControls } from '../lib/loadSceneCameraControls';
import { loadSceneRoot } from '../lib/loadSceneRoot';

export type SceneModulesStateValue
  = | { error: unknown; kind: 'failed' }
    | { kind: 'loaded'; rootModule: SceneRootModuleValue; sceneModule: SceneModuleValue }
    | { kind: 'loading' };

type SceneRootModuleValue = Awaited<ReturnType<typeof loadSceneRoot>>;

const LOADING_STATE: SceneModulesStateValue = { kind: 'loading' };

const peekModules = (loadScene: CachedModuleLoader<SceneModuleValue>): SceneModulesStateValue => {
  const rootModule = loadSceneRoot.peekLoadedModule();
  const sceneModule = loadScene.peekLoadedModule();

  if (rootModule === undefined || sceneModule === undefined) {
    return LOADING_STATE;
  }

  return { kind: 'loaded', rootModule, sceneModule };
};

export const useSceneModules = (loadScene: CachedModuleLoader<SceneModuleValue>): SceneModulesStateValue => {
  const [modulesState, setModulesState] = useState(() => peekModules(loadScene));

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
