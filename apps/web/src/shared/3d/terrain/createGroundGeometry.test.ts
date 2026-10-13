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

  it('uses the generated positions as they are, without an index', () => {
    expect(geometry.getAttribute('position').array).toBe(terrain.groundPositions);
    expect(geometry.getAttribute('position').count).toBe(terrain.triangleCount * 3);
    expect(geometry.index).toBeNull();
  });

  it('adds one group per surface, numbered like the material list, covering all vertices once', () => {
    expect(geometry.groups).toEqual(
      terrain.groundGroups.map((group, materialIndex) => ({ count: group.count, materialIndex, start: group.start })),
    );
    expect(geometry.groups.reduce((total, group) => total + group.count, 0)).toBe(terrain.triangleCount * 3);
  });

  it('frames the whole world so the ground is never culled', () => {
    expect(geometry.boundingBox?.min.x).toBeCloseTo(WORLD.bounds.minX, 3);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(WORLD.bounds.maxZ, 3);
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(WORLD_SIZE_METERS / 2);
  });
});
