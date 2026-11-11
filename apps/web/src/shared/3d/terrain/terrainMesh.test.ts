import {
  describe,
  expect,
  it,
} from 'vitest';

import { createSquareWorld } from '../world/sceneWorld';
import {
  TERRAIN_SURFACE_FIELD,
  TERRAIN_SURFACE_GROUND,
  TERRAIN_SURFACE_WATER,
} from './terrainConstants';
import { createTerrainContext } from './terrainContext';
import { buildGroundMesh } from './terrainMesh';
import { EMPTY_TERRAIN_RESERVED } from './terrainReserve';

describe('buildGroundMesh', () => {
  it('shares identical vertices while keeping the surface transitions and water separate', () => {
    const context = createTerrainContext({ reserved: EMPTY_TERRAIN_RESERVED, seed: 1, world: createSquareWorld(4) });
    const { grid, vertexX, vertexZ } = context;
    const surfaces = new Uint8Array([
      TERRAIN_SURFACE_FIELD, TERRAIN_SURFACE_GROUND, TERRAIN_SURFACE_GROUND, TERRAIN_SURFACE_GROUND,
      TERRAIN_SURFACE_GROUND, TERRAIN_SURFACE_GROUND, TERRAIN_SURFACE_WATER, TERRAIN_SURFACE_WATER,
    ]);
    const mesh = buildGroundMesh(context, surfaces, new Float32Array(grid.vertexCount), { meshX: vertexX, meshZ: vertexZ });
    const positions = mesh.groundPositions;
    const weights = mesh.groundWeights;
    const index = mesh.groundIndex;

    expect(index).toBeInstanceOf(Uint16Array);
    expect(index).toHaveLength(24);
    expect(positions.length / 3).toBeLessThan(index.length);
    expect(mesh.groundGroups.map(group => group.key)).toEqual(['ground', 'field', 'water']);

    const centerWeights = mesh.groundGroups.map(({ count, start }) => {
      const vertex = index.subarray(start, start + count)
        .find(candidate => positions[candidate * 3] === 0 && positions[candidate * 3 + 2] === 0);

      return vertex === undefined ? undefined : [...weights.slice(vertex * 5, vertex * 5 + 5)];
    });
    const [ground, field, water] = centerWeights;

    expect(ground?.reduce((total, value) => total + value, 0)).toBe(255);
    expect(field?.reduce((total, value) => total + value, 0)).toBe(255);
    expect(ground?.[TERRAIN_SURFACE_FIELD]).toBeGreaterThan(0);
    expect(field?.[TERRAIN_SURFACE_FIELD]).toBeGreaterThan(ground?.[TERRAIN_SURFACE_FIELD] ?? 0);
    expect(water).toEqual([0, 0, 0, 0, 0]);
  });

  it('fades sand away from road corridors without painting building reserves', () => {
    const context = createTerrainContext({
      reserved: {
        areas: [{ radius: 2, x: 0, z: 6 }],
        corridors: [{ points: [{ x: -6, z: 0 }, { x: 6, z: 0 }], width: 4 }],
      },
      seed: 1,
      world: createSquareWorld(16),
    });
    const { grid, vertexX, vertexZ } = context;
    const { groundPositions, groundWeights } = buildGroundMesh(
      context,
      new Uint8Array(grid.triangleCount),
      new Float32Array(grid.vertexCount),
      { meshX: vertexX, meshZ: vertexZ },
    );
    const sandAt = (z: number): number | undefined => {
      for (let vertex = 0; vertex < groundPositions.length / 3; vertex += 1) {
        if (groundPositions[vertex * 3] === 0 && groundPositions[vertex * 3 + 2] === z) {
          return groundWeights[vertex * 5 + 4];
        }
      }

      return undefined;
    };

    expect(sandAt(0)).toBeGreaterThan(sandAt(2) ?? 0);
    expect(sandAt(2)).toBeGreaterThan(0);
    expect(sandAt(4)).toBe(0);
    expect(sandAt(6)).toBe(0);
  });
});
