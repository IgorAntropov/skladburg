import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { TerrainGenerator } from './createWorldTerrainLoader';
import type { WorldTerrainParamsValue } from './terrainTypes';

import { createSquareWorld } from '../world/sceneWorld';
import { WORLD_SIZE_METERS } from '../world/worldConstants';
import {
  createTerrainCacheKey,
  createWorldTerrainLoader,
} from './createWorldTerrainLoader';
import { generateWorldTerrain } from './generateWorldTerrain';
import { EMPTY_TERRAIN_RESERVED } from './terrainReserve';

const WORLD = createSquareWorld(WORLD_SIZE_METERS);
const GENERATION_MS = 12.3;

const createParams = (seed: number): WorldTerrainParamsValue => ({ reserved: EMPTY_TERRAIN_RESERVED, seed, world: WORLD });

const createGenerator = (): ReturnType<typeof vi.fn<TerrainGenerator>> =>
  vi.fn<TerrainGenerator>(params => Promise.resolve({
    generationMs: GENERATION_MS,
    source: 'worker',
    terrain: generateWorldTerrain(params),
  }));

describe('createTerrainCacheKey', () => {
  it('is equal for equal parameters and differs by seed, world and reserve', () => {
    const base = createParams(5);

    expect(createTerrainCacheKey(createParams(5))).toBe(createTerrainCacheKey(base));
    expect(createTerrainCacheKey(createParams(6))).not.toBe(createTerrainCacheKey(base));
    expect(createTerrainCacheKey({ ...base, world: createSquareWorld(WORLD_SIZE_METERS / 2) })).not.toBe(createTerrainCacheKey(base));
    expect(
      createTerrainCacheKey({ ...base, reserved: { areas: [{ radius: 10, x: 0, z: 0 }], corridors: [] } }),
    ).not.toBe(createTerrainCacheKey(base));
    expect(
      createTerrainCacheKey({
        ...base,
        reserved: { areas: [], corridors: [{ points: [{ x: 0, z: 0 }, { x: 5, z: 5 }], width: 4 }] },
      }),
    ).not.toBe(createTerrainCacheKey(base));
  });
});

describe('createWorldTerrainLoader', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a world once per parameters and shares the result', async () => {
    const generate = createGenerator();
    const load = createWorldTerrainLoader(generate);

    const first = load(createParams(101));
    const second = load(createParams(101));
    const other = load(createParams(102));

    expect(await first).toBe(await second);
    expect(await other).not.toBe(await first);
    expect(await load(createParams(101))).toBe(await first);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('keeps the cache of every loader apart', async () => {
    const generate = createGenerator();

    await createWorldTerrainLoader(generate)(createParams(1));
    await createWorldTerrainLoader(generate)(createParams(1));

    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('logs the generation time once per generated world and records it as a measure', async () => {
    const log = vi.spyOn(console, 'log');
    const load = createWorldTerrainLoader(createGenerator());

    await load(createParams(201));
    await load(createParams(201));

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      '> WorldTerrain -> generate:',
      expect.objectContaining({
        generationMs: GENERATION_MS,
        seed: 201,
        source: 'worker',
        totalMs: expect.any(Number) as number,
      }),
    );
    expect(performance.getEntriesByName('WorldTerrain.generate').length).toBeGreaterThan(0);
  });

  it('forgets a failed generation so the next call tries again', async () => {
    const generate = createGenerator();
    const load = createWorldTerrainLoader(generate);

    generate.mockRejectedValueOnce(new Error('generation failed'));

    await expect(load(createParams(301))).rejects.toThrow('generation failed');
    await expect(load(createParams(301))).resolves.toBeDefined();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('has nothing to peek at before the world is generated, while it generates and after a failure', async () => {
    const generate = createGenerator();
    const load = createWorldTerrainLoader(generate);

    generate.mockRejectedValueOnce(new Error('generation failed'));

    expect(load.peek(createParams(401))).toBeUndefined();

    const failedLoading = load(createParams(401));

    expect(load.peek(createParams(401))).toBeUndefined();
    await failedLoading.then(undefined, () => undefined);
    expect(load.peek(createParams(401))).toBeUndefined();

    const retriedLoading = load(createParams(401));

    expect(load.peek(createParams(401))).toBeUndefined();
    await retriedLoading;
  });

  it('gives the generated world to peek at by the parameters without generating again', async () => {
    const generate = createGenerator();
    const load = createWorldTerrainLoader(generate);
    const terrain = await load(createParams(402));

    expect(load.peek(createParams(402))).toBe(terrain);
    expect(load.peek(createParams(403))).toBeUndefined();
    expect(generate).toHaveBeenCalledOnce();
  });
});
