import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ITerrainWorker } from './runTerrainInWorker';
import type { WorldTerrainParamsValue } from './terrainTypes';

import { createSquareWorld } from '../world/sceneWorld';
import { WORLD_SIZE_METERS } from '../world/worldConstants';
import { runTerrainInWorker } from './runTerrainInWorker';
import { EMPTY_TERRAIN_RESERVED } from './terrainReserve';

const PARAMS: WorldTerrainParamsValue = {
  reserved: EMPTY_TERRAIN_RESERVED,
  seed: 3,
  world: createSquareWorld(WORLD_SIZE_METERS),
};

interface FakeTerrainWorkerValue {
  emit: (type: 'error' | 'message' | 'messageerror', event: Event) => void;
  postMessage: ReturnType<typeof vi.fn<(message: unknown) => void>>;
  terminate: ReturnType<typeof vi.fn<() => void>>;
  worker: ITerrainWorker;
}

const createFakeWorker = (): FakeTerrainWorkerValue => {
  const listeners = new Map<string, (event: Event) => void>();
  const postMessage = vi.fn<(message: unknown) => void>();
  const terminate = vi.fn<() => void>();

  return {
    emit: (type, event) => {
      listeners.get(type)?.(event);
    },
    postMessage,
    terminate,
    worker: {
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
      },
      postMessage,
      terminate,
    },
  };
};

describe('runTerrainInWorker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the parameters once and resolves with the answer, ending the worker', async () => {
    const fake = createFakeWorker();
    const terrain = { decor: [], forestShare: 0, groundGroups: [], groundPositions: new Float32Array(), triangleCount: 0 };
    const running = runTerrainInWorker(PARAMS, () => fake.worker);

    expect(fake.postMessage).toHaveBeenCalledExactlyOnceWith({ params: PARAMS });

    fake.emit('message', new MessageEvent('message', { data: { generationMs: 7, terrain } }));

    await expect(running).resolves.toEqual({ generationMs: 7, source: 'worker', terrain });
    expect(fake.terminate).toHaveBeenCalledOnce();
  });

  it('rejects when the worker cannot be created', async () => {
    await expect(runTerrainInWorker(PARAMS, () => {
      throw new Error('no worker');
    })).rejects.toThrow('no worker');
  });

  it('rejects and ends the worker when it fails', async () => {
    const fake = createFakeWorker();
    const running = runTerrainInWorker(PARAMS, () => fake.worker);

    fake.emit('error', new Event('error'));

    await expect(running).rejects.toThrow('terrain worker failed');
    expect(fake.terminate).toHaveBeenCalledOnce();
  });

  it('rejects and ends the worker when its answer cannot be read', async () => {
    const fake = createFakeWorker();
    const running = runTerrainInWorker(PARAMS, () => fake.worker);

    fake.emit('messageerror', new Event('messageerror'));

    await expect(running).rejects.toThrow('could not be read');
    expect(fake.terminate).toHaveBeenCalledOnce();
  });

  it('rejects and ends the worker when it does not answer in time', async () => {
    vi.useFakeTimers();
    const fake = createFakeWorker();
    const running = runTerrainInWorker(PARAMS, () => fake.worker, 5000);
    const outcome = expect(running).rejects.toThrow('did not answer in time');

    await vi.advanceTimersByTimeAsync(4999);

    expect(fake.terminate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    await outcome;
    expect(fake.terminate).toHaveBeenCalledOnce();
  });

  it('does not end the worker again by the timer once it has answered', async () => {
    vi.useFakeTimers();
    const fake = createFakeWorker();
    const terrain = { decor: [], forestShare: 0, groundGroups: [], groundPositions: new Float32Array(), triangleCount: 0 };
    const running = runTerrainInWorker(PARAMS, () => fake.worker, 5000);

    fake.emit('message', new MessageEvent('message', { data: { generationMs: 1, terrain } }));
    await vi.advanceTimersByTimeAsync(10000);

    await expect(running).resolves.toBeDefined();
    expect(fake.terminate).toHaveBeenCalledOnce();
  });

  it('leaves no timer running when the worker cannot be created', async () => {
    vi.useFakeTimers();

    await expect(runTerrainInWorker(PARAMS, () => {
      throw new Error('no worker');
    }, 5000)).rejects.toThrow('no worker');
    expect(vi.getTimerCount()).toBe(0);
  });
});
