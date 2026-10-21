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
    | { kind: 'loading'; rootModule: SceneRootModuleValue | undefined; sceneModule: SceneModuleValue<TData, TInteraction> | undefined };

type SceneRootModuleValue = Awaited<ReturnType<typeof loadSceneRoot>>;

const createModulesState = <TData, TInteraction>(
  rootModule: SceneRootModuleValue | undefined,
  sceneModule: SceneModuleValue<TData, TInteraction> | undefined,
): SceneModulesStateValue<TData, TInteraction> => {
  if (rootModule === undefined || sceneModule === undefined) {
    return { kind: 'loading', rootModule, sceneModule };
  }

  return { kind: 'loaded', rootModule, sceneModule };
};

export const useSceneModules = <TData, TInteraction>(
  loadScene: CachedModuleLoader<SceneModuleValue<TData, TInteraction>>,
): SceneModulesStateValue<TData, TInteraction> => {
  const [modulesState, setModulesState] = useState<SceneModulesStateValue<TData, TInteraction>>(
    () => createModulesState(loadSceneRoot.peekLoadedModule(), loadScene.peekLoadedModule()),
  );

  const isLoading = modulesState.kind === 'loading';

  useEffect(() => {
    if (!isLoading) {
      return undefined;
    }

    let isCancelled = false;

    loadSceneCameraControls().catch((error: unknown) => {
      console.log('> useSceneModules -> warmCameraControls:', { error });
    });

    const handleFailure = (error: unknown): void => {
      if (!isCancelled) {
        setModulesState(current => current.kind === 'failed' ? current : { error, kind: 'failed' });
      }
    };

    loadSceneRoot().then(
      (rootModule) => {
        if (!isCancelled) {
          setModulesState(current => current.kind === 'failed' ? current : createModulesState(rootModule, current.sceneModule));
        }
      },
      handleFailure,
    );

    loadScene().then(
      (sceneModule) => {
        if (!isCancelled) {
          setModulesState(current => current.kind === 'failed' ? current : createModulesState(current.rootModule, sceneModule));
        }
      },
      handleFailure,
    );

    return () => {
      isCancelled = true;
    };
  }, [isLoading, loadScene]);

  return modulesState;
};
