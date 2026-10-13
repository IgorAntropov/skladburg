import type { TerrainGenerator } from './createWorldTerrainLoader';
import type { TerrainGenerationValue } from './runTerrainInWorker';
import type { WorldTerrainParamsValue } from './terrainTypes';

export const createTerrainGenerator = (
  generateInWorker: TerrainGenerator,
  generateOnMainThread: TerrainGenerator,
): TerrainGenerator => {
  return async (params: WorldTerrainParamsValue): Promise<TerrainGenerationValue> => {
    try {
      return await generateInWorker(params);
    }
    catch (error) {
      console.log('> TerrainGenerator -> fallbackToMainThread:', { error });

      return generateOnMainThread(params);
    }
  };
};
