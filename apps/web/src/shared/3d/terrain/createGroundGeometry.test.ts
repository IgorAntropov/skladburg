import {
  describe,
  expect,
  it,
} from 'vitest';

import { createSquareWorld } from '../world/sceneWorld';
import { WORLD_SIZE_METERS } from '../world/worldConstants';
import { createGroundGeometry } from './createGroundGeometry';
import { generateWorldTerrain } from './generateWorldTerrain';
import { EMPTY_TERRAIN_RESERVED } from './terrainReserve';

const WORLD = createSquareWorld(WORLD_SIZE_METERS);

describe('createGroundGeometry', () => {
  const terrain = generateWorldTerrain({ reserved: EMPTY_TERRAIN_RESERVED, seed: 7, world: WORLD });
  const geometry = createGroundGeometry(terrain);

  it('uses the transferred buffers and draws only land and water', () => {
    const water = terrain.groundGroups.find(group => group.key === 'water');

    expect(geometry.getAttribute('position').array).toBe(terrain.groundPositions);
    expect(geometry.index?.array).toBe(terrain.groundIndex);
    expect(geometry.groups).toEqual([
      { count: water?.start, materialIndex: 0, start: 0 },
      { count: water?.count, materialIndex: 1, start: water?.start },
    ]);
    expect(geometry.groups.reduce((total, group) => total + group.count, 0)).toBe(terrain.triangleCount * 3);
  });

  it('frames the whole world so the ground is never culled', () => {
    expect(geometry.boundingBox?.min.x).toBeCloseTo(WORLD.bounds.minX, 3);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(WORLD.bounds.maxZ, 3);
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(WORLD_SIZE_METERS / 2);
  });
});
