import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type {
  CachedModuleLoader,
  ChunkRecoveryValue,
} from '@/shared/lib/module-loader';

import { getChunkRecovery } from '@/shared/lib/module-loader';

export type LoadedModuleStateValue<TModule>
  = | { kind: 'failed'; recovery: ChunkRecoveryValue }
    | { kind: 'loaded'; module: TModule }
    | { kind: 'loading' };

export interface LoadedModuleValue<TModule> {
  isRetrying: boolean;
  retry: () => void;
  state: LoadedModuleStateValue<TModule>;
}

const LOADING_STATE = { kind: 'loading' } as const;

const peekState = <TModule>(loader: CachedModuleLoader<TModule>): LoadedModuleStateValue<TModule> => {
  const loadedModule = loader.peekLoadedModule();

  return loadedModule === undefined ? LOADING_STATE : { kind: 'loaded', module: loadedModule };
};

export const useLoadedModule = <TModule>(loader: CachedModuleLoader<TModule>): LoadedModuleValue<TModule> => {
  const [state, setState] = useState<LoadedModuleStateValue<TModule>>(() => peekState(loader));
  const [attempt, setAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const isLoaded = state.kind === 'loaded';

  const retry = useCallback((): void => {
    console.log('> useLoadedModule -> retry:', {});
    setIsRetrying(true);
    setAttempt(current => current + 1);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      return undefined;
    }

    let isCancelled = false;

    loader().then(
      (loadedModule) => {
        if (!isCancelled) {
          setState({ kind: 'loaded', module: loadedModule });
          setIsRetrying(false);
        }
      },
      (error: unknown) => {
        console.log('> useLoadedModule -> load:', { error });

        if (!isCancelled) {
          setState({ kind: 'failed', recovery: getChunkRecovery(error) });
          setIsRetrying(false);
        }
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [attempt, isLoaded, loader]);

  return { isRetrying, retry, state };
};
