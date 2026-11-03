import type { ComponentType } from 'react';

import {
  useCallback,
  useState,
} from 'react';

import type { ChunkRecoveryValue } from '@/shared/lib/module-loader';

import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  getChunkRecovery,
} from '@/shared/lib/module-loader';

import type { SearchControllerProps } from '../model/searchPanelTypes';

import { loadSearchPanel } from './loadSearchPanel';

export interface SearchPanelLoaderValue {
  dismissError: () => void;
  start: () => void;
  state: SearchPanelLoadStateValue;
  warmUp: () => void;
}

export type SearchPanelLoadStateValue
  = | { Controller: ComponentType<SearchControllerProps>; kind: 'ready' }
    | { kind: 'error'; recovery: ChunkRecoveryValue }
    | { kind: 'idle' }
    | { kind: 'loading' };

const IDLE_STATE: SearchPanelLoadStateValue = { kind: 'idle' };

const loadCachedPanel = createCachedModuleLoader(loadSearchPanel);

const createInitialState = (): SearchPanelLoadStateValue => {
  const loadedModule = loadCachedPanel.peekLoadedModule();

  return loadedModule === undefined ? IDLE_STATE : { Controller: loadedModule.SearchController, kind: 'ready' };
};

export const useSearchPanelLoader = (): SearchPanelLoaderValue => {
  const { locale } = useI18n();
  const [state, setState] = useState<SearchPanelLoadStateValue>(createInitialState);

  const isStartable = state.kind === 'error' || state.kind === 'idle';

  const warmUp = useCallback((): void => {
    void loadCachedPanel().then(
      (loadedModule) => {
        loadedModule.requestGlobalSearchTexts(locale);
      },
      () => undefined,
    );
  }, [locale]);

  const start = useCallback((): void => {
    if (!isStartable) {
      return;
    }

    setState({ kind: 'loading' });
    void loadCachedPanel().then(
      (loadedModule) => {
        loadedModule.requestGlobalSearchTexts(locale);
        setState({ Controller: loadedModule.SearchController, kind: 'ready' });
      },
      (error: unknown) => {
        console.log('> useSearchPanelLoader -> start:', { error });
        setState({ kind: 'error', recovery: getChunkRecovery(error) });
      },
    );
  }, [isStartable, locale]);

  const dismissError = useCallback((): void => {
    setState(current => (current.kind === 'error' ? IDLE_STATE : current));
  }, []);

  return { dismissError, start, state, warmUp };
};
