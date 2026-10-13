import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { TerrainGenerator } from './createWorldTerrainLoader';
import type {
  ITerrainWorker,
  TerrainGenerationValue,
} from './runTerrainInWorker';
import type { WorldTerrainParamsValue } from './terrainTypes';

import { createSquareWorld } from '../world/sceneWorld';
import { WORLD_SIZE_METERS } from '../world/worldConstants';
import { createTerrainGenerator } from './createTerrainGenerator';
import { createWorldTerrainLoader } from './createWorldTerrainLoader';
import { generateTerrainOnMainThread } from './generateTerrainOnMainThread';
import { generateWorldTerrain } from './generateWorldTerrain';
import { runTerrainInWorker } from './runTerrainInWorker';
import { TERRAIN_WORKER_TIMEOUT_MS } from './terrainConstants';
import { EMPTY_TERRAIN_RESERVED } from './terrainReserve';

const PARAMS: WorldTerrainParamsValue = {
  reserved: EMPTY_TERRAIN_RESERVED,
  seed: 11,
  world: createSquareWorld(WORLD_SIZE_METERS),
};

const createMainResult = (): TerrainGenerationValue => ({
  generationMs: 5,
  source: 'main',
  terrain: { decor: [], forestShare: 0, groundGroups: [], groundPositions: new Float32Array(), triangleCount: 0 },
});

const createFailingWorker = (): ITerrainWorker => ({
  addEventListener: (type, listener) => {
    if (type === 'error') {
      queueMicrotask(() => {
        listener(new Event('error'));
      });
    }
  },
  postMessage: () => undefined,
  terminate: () => undefined,
});

const createAnsweringWorker = (answer: TerrainGenerationValue): ITerrainWorker => {
  let onMessage: ((event: Event) => void) | undefined;

  return {
    addEventListener: (type, listener) => {
      if (type === 'message') {
        onMessage = listener;
      }
    },
    postMessage: () => {
      queueMicrotask(() => {
        onMessage?.(new MessageEvent('message', { data: { generationMs: answer.generationMs, terrain: answer.terrain } }));
      });
    },
    terminate: () => undefined,
  };
};

describe('createTerrainGenerator', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('answers from the worker and leaves the main thread generator alone', async () => {
    const workerResult = { ...createMainResult(), source: 'worker' as const };
    const generateOnMainThread = vi.fn<TerrainGenerator>();
    const generate = createTerrainGenerator(
      async params => runTerrainInWorker(params, () => createAnsweringWorker(workerResult)),
      generateOnMainThread,
    );

    await expect(generate(PARAMS)).resolves.toEqual(workerResult);
    expect(generateOnMainThread).not.toHaveBeenCalled();
  });

  it('falls back to the main thread when the worker reports an error', async () => {
    const mainResult = createMainResult();
    const generateOnMainThread = vi.fn<TerrainGenerator>(() => Promise.resolve(mainResult));
    const generate = createTerrainGenerator(
      async params => runTerrainInWorker(params, createFailingWorker),
      generateOnMainThread,
    );

    await expect(generate(PARAMS)).resolves.toBe(mainResult);
    expect(generateOnMainThread).toHaveBeenCalledExactlyOnceWith(PARAMS);
  });

  it('falls back to the main thread when the worker does not answer in time', async () => {
    vi.useFakeTimers();
    const terminate = vi.fn<() => void>();
    const mainResult = createMainResult();
    const generateOnMainThread = vi.fn<TerrainGenerator>(() => Promise.resolve(mainResult));
    const generate = createTerrainGenerator(
      async params => runTerrainInWorker(params, () => ({
        addEventListener: () => undefined,
        postMessage: () => undefined,
        terminate,
      })),
      generateOnMainThread,
    );
    const generating = generate(PARAMS);

    await vi.advanceTimersByTimeAsync(TERRAIN_WORKER_TIMEOUT_MS);

    await expect(generating).resolves.toBe(mainResult);
    expect(terminate).toHaveBeenCalledOnce();
    expect(generateOnMainThread).toHaveBeenCalledExactlyOnceWith(PARAMS);
  });

  it('falls back to the main thread when the worker cannot be created', async () => {
    const mainResult = createMainResult();
    const generateOnMainThread = vi.fn<TerrainGenerator>(() => Promise.resolve(mainResult));
    const generate = createTerrainGenerator(
      async params => runTerrainInWorker(params, () => {
        throw new Error('no worker');
      }),
      generateOnMainThread,
    );

    await expect(generate(PARAMS)).resolves.toBe(mainResult);
    expect(generateOnMainThread).toHaveBeenCalledOnce();
  });

  it('lets the loader report the main thread source and cache the fallback world', async () => {
    const generateOnMainThread = vi.fn<TerrainGenerator>(() => Promise.resolve(createMainResult()));
    const load = createWorldTerrainLoader(createTerrainGenerator(
      async params => runTerrainInWorker(params, createFailingWorker),
      generateOnMainThread,
    ));
    const log = vi.spyOn(console, 'log');

    const first = await load(PARAMS);

    expect(await load(PARAMS)).toBe(first);
    expect(generateOnMainThread).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('> WorldTerrain -> generate:', expect.objectContaining({ source: 'main' }));
  });

  it('fails when the main thread generator fails too, leaving the loader free to retry', async () => {
    const generateOnMainThread = vi.fn<TerrainGenerator>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce(createMainResult());
    const load = createWorldTerrainLoader(createTerrainGenerator(
      async params => runTerrainInWorker(params, createFailingWorker),
      generateOnMainThread,
    ));

    await expect(load(PARAMS)).rejects.toThrow('chunk failed');
    await expect(load(PARAMS)).resolves.toBeDefined();
  });
});

describe('generateTerrainOnMainThread', () => {
  it('produces the same world as the generator itself and marks the main thread as the source', async () => {
    const result = await generateTerrainOnMainThread(PARAMS);

    expect(result.source).toBe('main');
    expect(result.generationMs).toBeGreaterThanOrEqual(0);
    expect(result.terrain).toEqual(generateWorldTerrain(PARAMS));
  });
});
