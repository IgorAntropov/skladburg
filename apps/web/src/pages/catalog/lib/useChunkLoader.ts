import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  CachedModuleLoader,
  ChunkRecoveryValue,
} from '@/shared/lib/module-loader';

import { getChunkRecovery } from '@/shared/lib/module-loader';

export interface ChunkLoaderValue<TModule> {
  load: () => void;
  state: ChunkStateValue<TModule>;
}

export type ChunkStateValue<TModule>
  = | { kind: 'failed'; recovery: ChunkRecoveryValue }
    | { kind: 'idle' }
    | { kind: 'loaded'; module: TModule }
    | { kind: 'loading' };

const IDLE_STATE = { kind: 'idle' } as const;
const LOADING_STATE = { kind: 'loading' } as const;

const peekState = <TModule>(loader: CachedModuleLoader<TModule>): ChunkStateValue<TModule> => {
  const loadedModule = loader.peekLoadedModule();

  return loadedModule === undefined ? IDLE_STATE : { kind: 'loaded', module: loadedModule };
};

export const useChunkLoader = <TModule>(loader: CachedModuleLoader<TModule>): ChunkLoaderValue<TModule> => {
  const requestSequenceRef = useRef(0);
  const [state, setState] = useState<ChunkStateValue<TModule>>(() => peekState(loader));

  const load = useCallback((): void => {
    const loadedModule = loader.peekLoadedModule();

    if (loadedModule !== undefined) {
      setState(current => (current.kind === 'loaded' ? current : { kind: 'loaded', module: loadedModule }));

      return;
    }

    requestSequenceRef.current += 1;
    const requestSequence = requestSequenceRef.current;

    setState(LOADING_STATE);
    loader().then(
      (module) => {
        if (requestSequenceRef.current === requestSequence) {
          setState({ kind: 'loaded', module });
        }
      },
      (error: unknown) => {
        console.log('> useChunkLoader -> load:', { error });

        if (requestSequenceRef.current === requestSequence) {
          setState({ kind: 'failed', recovery: getChunkRecovery(error) });
        }
      },
    );
  }, [loader]);

  useEffect(() => () => {
    requestSequenceRef.current += 1;
  }, []);

  return { load, state };
};
