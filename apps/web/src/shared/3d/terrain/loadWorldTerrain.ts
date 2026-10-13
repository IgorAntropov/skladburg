import { createTerrainGenerator } from './createTerrainGenerator';
import { createWorldTerrainLoader } from './createWorldTerrainLoader';
import { generateTerrainOnMainThread } from './generateTerrainOnMainThread';
import { runTerrainInWorker } from './runTerrainInWorker';

export const loadWorldTerrain = createWorldTerrainLoader(
  createTerrainGenerator(async params => runTerrainInWorker(params), generateTerrainOnMainThread),
);
