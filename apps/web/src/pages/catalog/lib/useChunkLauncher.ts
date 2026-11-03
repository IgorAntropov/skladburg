import {
  useCallback,
  useState,
} from 'react';

import type {
  CachedModuleLoader,
  ChunkRecoveryValue,
} from '@/shared/lib/module-loader';

import { useChunkLoader } from './useChunkLoader';

export interface ChunkLauncherValue<TModule> {
  close: () => void;
  isLoading: boolean;
  loadRecovery: ChunkRecoveryValue | undefined;
  module: TModule | undefined;
  open: () => void;
  warmUp: () => void;
}

export const useChunkLauncher = <TModule>(loader: CachedModuleLoader<TModule>): ChunkLauncherValue<TModule> => {
  const { load, state } = useChunkLoader(loader);
  const [isRequested, setIsRequested] = useState(false);

  const open = useCallback((): void => {
    console.log('> useChunkLauncher -> open:', { kind: state.kind });
    setIsRequested(true);

    if (state.kind !== 'loading' && state.kind !== 'loaded') {
      load();
    }
  }, [load, state.kind]);

  const close = useCallback((): void => {
    console.log('> useChunkLauncher -> close:', {});
    setIsRequested(false);
  }, []);

  const warmUp = useCallback((): void => {
    if (loader.peekLoadedModule() === undefined) {
      loader().then(undefined, (error: unknown) => {
        console.log('> useChunkLauncher -> warmUp:', { error });
      });
    }
  }, [loader]);

  return {
    close,
    isLoading: isRequested && (state.kind === 'loading' || state.kind === 'idle'),
    loadRecovery: isRequested && state.kind === 'failed' ? state.recovery : undefined,
    module: isRequested && state.kind === 'loaded' ? state.module : undefined,
    open,
    warmUp,
  };
};
