import type { ChunkRecoveryValue } from '@/shared/lib/module-loader';

import {
  ChunkLoadError,
  getChunkRecovery,
} from '@/shared/lib/module-loader';

export type SceneViewportEventValue
  = | { error: unknown; kind: 'failed' }
    | { kind: 'contextLost' }
    | { kind: 'ready' }
    | { kind: 'retry' };

export type SceneViewportPhaseValue = 'error' | 'loading' | 'ready' | 'unavailable';

export interface SceneViewportStateValue {
  attempt: number;
  contextLossCount: number;
  phase: SceneViewportPhaseValue;
  recovery: ChunkRecoveryValue | undefined;
}

export const INITIAL_SCENE_VIEWPORT_STATE: SceneViewportStateValue = {
  attempt: 0,
  contextLossCount: 0,
  phase: 'loading',
  recovery: undefined,
};

const isFailureFinal = (phase: SceneViewportPhaseValue): boolean => phase === 'error' || phase === 'unavailable';

export const reduceSceneViewport = (
  state: SceneViewportStateValue,
  event: SceneViewportEventValue,
): SceneViewportStateValue => {
  if (event.kind === 'ready') {
    return state.phase === 'loading' ? { ...state, phase: 'ready' } : state;
  }

  if (event.kind === 'retry') {
    return state.phase === 'error'
      ? { ...state, attempt: state.attempt + 1, phase: 'loading', recovery: undefined }
      : state;
  }

  if (event.kind === 'contextLost') {
    if (isFailureFinal(state.phase)) {
      return state;
    }

    return state.contextLossCount === 0
      ? { attempt: state.attempt + 1, contextLossCount: 1, phase: 'loading', recovery: undefined }
      : { ...state, contextLossCount: state.contextLossCount + 1, phase: 'unavailable', recovery: undefined };
  }

  if (isFailureFinal(state.phase)) {
    return state;
  }

  if (event.error instanceof ChunkLoadError) {
    return { ...state, phase: 'error', recovery: getChunkRecovery(event.error) };
  }

  return { ...state, phase: 'unavailable', recovery: undefined };
};
