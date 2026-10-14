import {
  describe,
  expect,
  it,
} from 'vitest';

import { ChunkLoadError } from '@/shared/lib/module-loader';

import type { SceneViewportStateValue } from './sceneViewportMachine';

import {
  INITIAL_SCENE_VIEWPORT_STATE,
  reduceSceneViewport,
} from './sceneViewportMachine';

const READY_STATE: SceneViewportStateValue = { ...INITIAL_SCENE_VIEWPORT_STATE, phase: 'ready' };
const FIRST_CHUNK_ERROR = new ChunkLoadError(1);
const SECOND_CHUNK_ERROR = new ChunkLoadError(2);

describe('reduceSceneViewport', () => {
  it('starts in loading and becomes ready after the first frame', () => {
    expect(INITIAL_SCENE_VIEWPORT_STATE.phase).toBe('loading');
    expect(reduceSceneViewport(INITIAL_SCENE_VIEWPORT_STATE, { kind: 'ready' }).phase).toBe('ready');
  });

  it('offers a retry after the first chunk failure and a reload after the second', () => {
    const first = reduceSceneViewport(INITIAL_SCENE_VIEWPORT_STATE, { error: FIRST_CHUNK_ERROR, kind: 'failed' });
    const retried = reduceSceneViewport(first, { kind: 'retry' });
    const second = reduceSceneViewport(retried, { error: SECOND_CHUNK_ERROR, kind: 'failed' });

    expect(first).toEqual({ attempt: 0, contextLossCount: 0, phase: 'error', recovery: 'retry' });
    expect(retried).toEqual({ attempt: 1, contextLossCount: 0, phase: 'loading', recovery: undefined });
    expect(second).toEqual({ attempt: 1, contextLossCount: 0, phase: 'error', recovery: 'reload' });
  });

  it('treats any other failure as an unavailable scene, also after the first frame', () => {
    const renderFailure = new Error('the WebGL context was not created');

    expect(reduceSceneViewport(INITIAL_SCENE_VIEWPORT_STATE, { error: renderFailure, kind: 'failed' }).phase).toBe('unavailable');
    expect(reduceSceneViewport(READY_STATE, { error: renderFailure, kind: 'failed' }).phase).toBe('unavailable');
  });

  it('ignores a retry outside the error phase', () => {
    expect(reduceSceneViewport(INITIAL_SCENE_VIEWPORT_STATE, { kind: 'retry' })).toBe(INITIAL_SCENE_VIEWPORT_STATE);
    expect(reduceSceneViewport(READY_STATE, { kind: 'retry' })).toBe(READY_STATE);
  });

  it('keeps a final failure when more events arrive', () => {
    const unavailable = reduceSceneViewport(INITIAL_SCENE_VIEWPORT_STATE, { error: new Error('lost'), kind: 'failed' });

    expect(reduceSceneViewport(unavailable, { kind: 'ready' })).toBe(unavailable);
    expect(reduceSceneViewport(unavailable, { error: FIRST_CHUNK_ERROR, kind: 'failed' })).toBe(unavailable);
  });

  describe('context loss', () => {
    it('restarts the scene silently after the first loss', () => {
      expect(reduceSceneViewport(READY_STATE, { kind: 'contextLost' })).toEqual({
        attempt: 1,
        contextLossCount: 1,
        phase: 'loading',
        recovery: undefined,
      });
    });

    it('also restarts the scene when the first loss happens while it is loading', () => {
      expect(reduceSceneViewport(INITIAL_SCENE_VIEWPORT_STATE, { kind: 'contextLost' })).toEqual({
        attempt: 1,
        contextLossCount: 1,
        phase: 'loading',
        recovery: undefined,
      });
    });

    it('gives up after the second loss', () => {
      const restarted = reduceSceneViewport(READY_STATE, { kind: 'contextLost' });
      const rendered = reduceSceneViewport(restarted, { kind: 'ready' });
      const lostAgain = reduceSceneViewport(rendered, { kind: 'contextLost' });

      expect(rendered.phase).toBe('ready');
      expect(lostAgain.phase).toBe('unavailable');
      expect(lostAgain.contextLossCount).toBe(2);
      expect(lostAgain.recovery).toBeUndefined();
    });

    it('gives up when the second loss comes before the restarted scene is ready', () => {
      const restarted = reduceSceneViewport(READY_STATE, { kind: 'contextLost' });

      expect(reduceSceneViewport(restarted, { kind: 'contextLost' }).phase).toBe('unavailable');
    });

    it('ignores a loss after a final failure', () => {
      const failed = reduceSceneViewport(INITIAL_SCENE_VIEWPORT_STATE, { error: FIRST_CHUNK_ERROR, kind: 'failed' });
      const unavailable = reduceSceneViewport(INITIAL_SCENE_VIEWPORT_STATE, { error: new Error('lost'), kind: 'failed' });

      expect(reduceSceneViewport(failed, { kind: 'contextLost' })).toBe(failed);
      expect(reduceSceneViewport(unavailable, { kind: 'contextLost' })).toBe(unavailable);
    });

    it('keeps the loss count when the scene is retried after an error', () => {
      const restarted = reduceSceneViewport(READY_STATE, { kind: 'contextLost' });
      const failed = reduceSceneViewport(restarted, { error: FIRST_CHUNK_ERROR, kind: 'failed' });
      const retried = reduceSceneViewport(failed, { kind: 'retry' });

      expect(retried).toEqual({ attempt: 2, contextLossCount: 1, phase: 'loading', recovery: undefined });
    });
  });
});
