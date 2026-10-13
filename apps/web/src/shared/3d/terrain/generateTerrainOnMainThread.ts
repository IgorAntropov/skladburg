import type { TerrainGenerationValue } from './runTerrainInWorker';
import type { WorldTerrainParamsValue } from './terrainTypes';

export const generateTerrainOnMainThread = async (params: WorldTerrainParamsValue): Promise<TerrainGenerationValue> => {
  const { generateWorldTerrain } = await import('./generateWorldTerrain');
  const startedAt = performance.now();
  const terrain = generateWorldTerrain(params);

  return { generationMs: performance.now() - startedAt, source: 'main', terrain };
};
