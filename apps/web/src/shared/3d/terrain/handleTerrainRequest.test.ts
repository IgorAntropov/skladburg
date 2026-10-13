import {
  describe,
  expect,
  it,
} from 'vitest';

import { createSquareWorld } from '../world/sceneWorld';
import { WORLD_SIZE_METERS } from '../world/worldConstants';
import { generateWorldTerrain } from './generateWorldTerrain';
import { handleTerrainRequest } from './handleTerrainRequest';
import { EMPTY_TERRAIN_RESERVED } from './terrainReserve';

const PARAMS = { reserved: EMPTY_TERRAIN_RESERVED, seed: 42, world: createSquareWorld(WORLD_SIZE_METERS) };

describe('handleTerrainRequest', () => {
  const { response, transfer } = handleTerrainRequest({ params: PARAMS });

  it('answers with the generated world and the time spent generating it', () => {
    const expected = generateWorldTerrain(PARAMS);

    expect(response.generationMs).toBeGreaterThanOrEqual(0);
    expect(response.terrain.triangleCount).toBe(expected.triangleCount);
    expect(response.terrain.groundGroups).toEqual(expected.groundGroups);
    expect(Array.from(response.terrain.groundPositions)).toEqual(Array.from(expected.groundPositions));
  });

  it('lists every array buffer of the world exactly once for the transfer', () => {
    const arrays = [
      response.terrain.groundPositions,
      ...response.terrain.decor.flatMap(decor => [decor.matrices, decor.ranks, decor.tints]),
    ];

    expect(new Set(transfer).size).toBe(transfer.length);
    expect(transfer.length).toBe(arrays.length);

    for (const array of arrays) {
      expect(transfer).toContain(array.buffer);
    }
  });
});
