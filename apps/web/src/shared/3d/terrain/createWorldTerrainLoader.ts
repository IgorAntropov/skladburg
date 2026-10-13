import type { TerrainGenerationValue } from './runTerrainInWorker';
import type {
  WorldTerrainParamsValue,
  WorldTerrainValue,
} from './terrainTypes';

export type TerrainGenerator = (params: WorldTerrainParamsValue) => Promise<TerrainGenerationValue>;

export interface WorldTerrainLoader {
  (params: WorldTerrainParamsValue): Promise<WorldTerrainValue>;
  peek: (params: WorldTerrainParamsValue) => undefined | WorldTerrainValue;
}

const MEASURE_NAME = 'WorldTerrain.generate';
const MILLISECOND_DECIMALS = 10;

const roundMs = (value: number): number => Math.round(value * MILLISECOND_DECIMALS) / MILLISECOND_DECIMALS;

export const createTerrainCacheKey = (params: WorldTerrainParamsValue): string => {
  const { bounds } = params.world;

  return JSON.stringify([
    params.seed,
    bounds.minX,
    bounds.maxX,
    bounds.minZ,
    bounds.maxZ,
    params.reserved.areas.map(area => [area.x, area.z, area.radius]),
    params.reserved.corridors.map(corridor => [corridor.width, corridor.points.map(point => [point.x, point.z])]),
  ]);
};

export const createWorldTerrainLoader = (
  generate: TerrainGenerator,
): WorldTerrainLoader => {
  const terrainCache = new Map<string, Promise<WorldTerrainValue>>();
  const loadedTerrains = new Map<string, WorldTerrainValue>();

  const generateTimed = async (params: WorldTerrainParamsValue): Promise<WorldTerrainValue> => {
    const startedAt = performance.now();
    const { generationMs, source, terrain } = await generate(params);
    const finishedAt = performance.now();

    performance.measure(MEASURE_NAME, { detail: { generationMs: roundMs(generationMs), source }, end: finishedAt, start: startedAt });
    console.log('> WorldTerrain -> generate:', {
      generationMs: roundMs(generationMs),
      seed: params.seed,
      source,
      totalMs: roundMs(finishedAt - startedAt),
      triangleCount: terrain.triangleCount,
    });

    return terrain;
  };

  const load = (params: WorldTerrainParamsValue): Promise<WorldTerrainValue> => {
    const key = createTerrainCacheKey(params);
    const cached = terrainCache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const loading = generateTimed(params);

    terrainCache.set(key, loading);
    loading.then(
      (terrain) => {
        loadedTerrains.set(key, terrain);
      },
      () => {
        terrainCache.delete(key);
      },
    );

    return loading;
  };

  const peek = (params: WorldTerrainParamsValue): undefined | WorldTerrainValue => loadedTerrains.get(createTerrainCacheKey(params));

  return Object.assign(load, { peek });
};
