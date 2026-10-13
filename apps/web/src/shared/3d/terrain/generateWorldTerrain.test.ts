import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  TerrainDecorValue,
  TerrainReservedValue,
  TerrainSurfaceKeyValue,
  WorldTerrainValue,
} from './terrainTypes';

import { createSquareWorld } from '../world/sceneWorld';
import { WORLD_SIZE_METERS } from '../world/worldConstants';
import { generateWorldTerrain } from './generateWorldTerrain';
import {
  TERRAIN_EDGE_CLEAR_METERS,
  TERRAIN_MIN_LAKE_CELLS,
  TERRAIN_TREE_SINK_METERS,
  TERRAIN_WATER_LEVEL_METERS,
} from './terrainConstants';
import { TERRAIN_DECOR_PARTS } from './terrainDecorParts';
import { getDecorCountForDensity } from './terrainInstances';
import {
  EMPTY_TERRAIN_RESERVED,
  getReserveDistance,
} from './terrainReserve';

const WORLD = createSquareWorld(WORLD_SIZE_METERS);
const HALF_WORLD = WORLD_SIZE_METERS / 2;
const SEEDS: readonly number[] = [1, 7, 42, 2026, 123456];
const MAX_RELIEF_METERS = 0.6;
const UNTOUCHED_DISTANCE_METERS = 22;
const OFF_GRID_DEGREES = 6;
const MIN_OFF_GRID_SHARE = 0.5;

const TEST_RESERVED: TerrainReservedValue = {
  areas: [
    { radius: 14, x: -60, z: -40 },
    { radius: 16, x: 30, z: 20 },
    { radius: 12, x: 0, z: 70 },
  ],
  corridors: [
    {
      points: [
        { x: -60, z: -40 },
        { x: -20, z: 0 },
        { x: 30, z: 20 },
      ],
      width: 6,
    },
    {
      points: [
        { x: 30, z: 20 },
        { x: 60, z: 60 },
        { x: 0, z: 70 },
      ],
      width: 6,
    },
  ],
};

interface TriangleValue {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
  key: TerrainSurfaceKeyValue;
}

const generate = (seed: number, reserved: TerrainReservedValue = EMPTY_TERRAIN_RESERVED): WorldTerrainValue =>
  generateWorldTerrain({ reserved, seed, world: WORLD });

const collectTriangles = (terrain: WorldTerrainValue): TriangleValue[] => {
  const triangles: TriangleValue[] = [];
  const positions = terrain.groundPositions;

  for (const group of terrain.groundGroups) {
    for (let vertex = group.start; vertex < group.start + group.count; vertex += 3) {
      const offset = vertex * 3;
      triangles.push({
        ax: positions[offset] ?? 0,
        ay: positions[offset + 1] ?? 0,
        az: positions[offset + 2] ?? 0,
        bx: positions[offset + 3] ?? 0,
        by: positions[offset + 4] ?? 0,
        bz: positions[offset + 5] ?? 0,
        cx: positions[offset + 6] ?? 0,
        cy: positions[offset + 7] ?? 0,
        cz: positions[offset + 8] ?? 0,
        key: group.key,
      });
    }
  }

  return triangles;
};

const toBytes = (array: Float32Array): Uint8Array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);

const getMatrices = (terrain: WorldTerrainValue, index: number): Float32Array => terrain.decor[index]?.matrices ?? new Float32Array();

const getShare = (triangles: readonly TriangleValue[], keys: readonly TerrainSurfaceKeyValue[]): number =>
  triangles.filter(triangle => keys.includes(triangle.key)).length / triangles.length;

const getEdgeDistance = (x: number, z: number): number =>
  Math.min(x + HALF_WORLD, HALF_WORLD - x, z + HALF_WORLD, HALF_WORLD - z);

const getCorners = (triangle: TriangleValue): readonly (readonly [number, number, number])[] => [
  [triangle.ax, triangle.ay, triangle.az],
  [triangle.bx, triangle.by, triangle.bz],
  [triangle.cx, triangle.cy, triangle.cz],
];

const getInstancePoints = (decor: TerrainDecorValue): { x: number; y: number; z: number }[] => {
  const points: { x: number; y: number; z: number }[] = [];

  for (let instance = 0; instance < decor.ranks.length; instance += 1) {
    points.push({
      x: decor.matrices[instance * 16 + 12] ?? 0,
      y: decor.matrices[instance * 16 + 13] ?? 0,
      z: decor.matrices[instance * 16 + 14] ?? 0,
    });
  }

  return points;
};

const getBarycentricWeights = (triangle: TriangleValue, x: number, z: number): { a: number; b: number } => {
  const spanZ = triangle.bz - triangle.cz;
  const spanX = triangle.cx - triangle.bx;
  const denominator = spanZ * (triangle.ax - triangle.cx) + spanX * (triangle.az - triangle.cz);

  return {
    a: (spanZ * (x - triangle.cx) + spanX * (z - triangle.cz)) / denominator,
    b: ((triangle.cz - triangle.az) * (x - triangle.cx) + (triangle.ax - triangle.cx) * (z - triangle.cz)) / denominator,
  };
};

const findGroundTriangle = (triangles: readonly TriangleValue[], x: number, z: number): TriangleValue | undefined =>
  triangles.find((triangle) => {
    const weights = getBarycentricWeights(triangle, x, z);

    return weights.a >= -1e-6 && weights.b >= -1e-6 && 1 - weights.a - weights.b >= -1e-6;
  });

const interpolateHeight = (triangle: TriangleValue, x: number, z: number): number => {
  const weights = getBarycentricWeights(triangle, x, z);

  return weights.a * triangle.ay + weights.b * triangle.by + (1 - weights.a - weights.b) * triangle.cy;
};

describe('generateWorldTerrain determinism', () => {
  it('returns byte-identical arrays for identical parameters', () => {
    const first = generate(42, TEST_RESERVED);
    const second = generate(42, TEST_RESERVED);

    expect(toBytes(second.groundPositions)).toEqual(toBytes(first.groundPositions));
    expect(second.groundGroups).toEqual(first.groundGroups);
    expect(second.forestShare).toBe(first.forestShare);
    expect(second.decor.map(decor => decor.kind)).toEqual(first.decor.map(decor => decor.kind));

    first.decor.forEach((decor, index) => {
      const other = second.decor[index];

      expect(toBytes(other?.matrices ?? new Float32Array())).toEqual(toBytes(decor.matrices));
      expect(toBytes(other?.ranks ?? new Float32Array())).toEqual(toBytes(decor.ranks));
      expect(toBytes(other?.tints ?? new Float32Array())).toEqual(toBytes(decor.tints));
    });
  });

  it('produces different worlds for different seeds', () => {
    const first = generate(1);
    const second = generate(2);

    expect(toBytes(second.groundPositions)).not.toEqual(toBytes(first.groundPositions));
    expect(toBytes(getMatrices(second, 0))).not.toEqual(toBytes(getMatrices(first, 0)));
  });

  it('does not depend on what was generated before', () => {
    const alone = generate(7);

    generate(99, TEST_RESERVED);
    generate(7, TEST_RESERVED);

    const afterOthers = generate(7);

    expect(toBytes(afterOthers.groundPositions)).toEqual(toBytes(alone.groundPositions));
    expect(toBytes(getMatrices(afterOthers, 1))).toEqual(toBytes(getMatrices(alone, 1)));
  });
});

describe.each(SEEDS)('generateWorldTerrain composition, seed %i', (seed) => {
  const terrain = generate(seed);
  const triangles = collectTriangles(terrain);

  it('keeps water at 6-14 percent, fields at 15-30 percent and forest at 10-25 percent of the area', () => {
    expect(getShare(triangles, ['water'])).toBeGreaterThanOrEqual(0.06);
    expect(getShare(triangles, ['water'])).toBeLessThanOrEqual(0.14);
    expect(getShare(triangles, ['field', 'fieldAlt'])).toBeGreaterThanOrEqual(0.15);
    expect(getShare(triangles, ['field', 'fieldAlt'])).toBeLessThanOrEqual(0.3);
    expect(terrain.forestShare).toBeGreaterThanOrEqual(0.1);
    expect(terrain.forestShare).toBeLessThanOrEqual(0.25);
  });

  it('uses both tones of meadow and of fields', () => {
    expect(getShare(triangles, ['ground'])).toBeGreaterThan(0.1);
    expect(getShare(triangles, ['groundAlt'])).toBeGreaterThan(0.1);
    expect(getShare(triangles, ['field'])).toBeGreaterThan(0.03);
    expect(getShare(triangles, ['fieldAlt'])).toBeGreaterThan(0.03);
  });

  it('wraps every water triangle in a sand strip', () => {
    const waterVertices = new Set<string>();

    for (const triangle of triangles.filter(candidate => candidate.key === 'water')) {
      for (const [x, , z] of getCorners(triangle)) {
        waterVertices.add([x, z].join(':'));
      }
    }

    const touching = triangles.filter(
      triangle => triangle.key !== 'water' && getCorners(triangle).some(([x, , z]) => waterVertices.has([x, z].join(':'))),
    );

    expect(waterVertices.size).toBeGreaterThan(0);
    expect(touching.length).toBeGreaterThan(0);
    expect(touching.every(triangle => triangle.key === 'sand')).toBe(true);
    expect(getShare(triangles, ['sand'])).toBeGreaterThan(0.02);
  });

  it('leaves no pond smaller than the minimum lake', () => {
    const parents = new Map<string, string>();
    const findRoot = (key: string): string => {
      let root = key;

      while ((parents.get(root) ?? root) !== root) {
        root = parents.get(root) ?? root;
      }

      return root;
    };
    const waterTriangles = triangles.filter(triangle => triangle.key === 'water');

    for (const triangle of waterTriangles) {
      const keys = getCorners(triangle).map(([x, , z]) => [x, z].join(':'));

      for (const key of keys) {
        if (!parents.has(key)) {
          parents.set(key, key);
        }
      }

      const [first = '', second = '', third = ''] = keys;
      parents.set(findRoot(second), findRoot(first));
      parents.set(findRoot(third), findRoot(first));
    }

    const sizes = new Map<string, number>();

    for (const triangle of waterTriangles) {
      const root = findRoot([triangle.ax, triangle.az].join(':'));
      sizes.set(root, (sizes.get(root) ?? 0) + 1);
    }

    expect(sizes.size).toBeGreaterThan(0);
    expect(Math.min(...sizes.values())).toBeGreaterThanOrEqual(TERRAIN_MIN_LAKE_CELLS * 2);
  });

  it('draws the shoreline off the grid directions, without runs along 0, 45 and 90 degrees', () => {
    const waterEdges = new Set<string>();

    for (const triangle of triangles.filter(candidate => candidate.key === 'water')) {
      const corners = getCorners(triangle);

      for (let index = 0; index < 3; index += 1) {
        const from = corners[index];
        const to = corners[(index + 1) % 3];

        if (from !== undefined && to !== undefined) {
          waterEdges.add([from[0], from[2], to[0], to[2]].join(':'));
          waterEdges.add([to[0], to[2], from[0], from[2]].join(':'));
        }
      }
    }

    let shoreEdges = 0;
    let offGridEdges = 0;

    for (const triangle of triangles.filter(candidate => candidate.key === 'sand')) {
      const corners = getCorners(triangle);

      for (let index = 0; index < 3; index += 1) {
        const from = corners[index];
        const to = corners[(index + 1) % 3];

        if (from !== undefined && to !== undefined && waterEdges.has([from[0], from[2], to[0], to[2]].join(':'))) {
          const angle = Math.atan2(to[2] - from[2], to[0] - from[0]) * (180 / Math.PI);
          const offset = Math.abs(((angle % 45) + 45) % 45);
          shoreEdges += 1;

          if (Math.min(offset, 45 - offset) > OFF_GRID_DEGREES) {
            offGridEdges += 1;
          }
        }
      }
    }

    expect(shoreEdges).toBeGreaterThan(100);
    expect(offGridEdges / shoreEdges).toBeGreaterThan(MIN_OFF_GRID_SHARE);
  });

  it('keeps the relief under 0.6 m, with water and fields perfectly flat', () => {
    let highest = 0;

    for (const triangle of triangles) {
      const heights = getCorners(triangle).map(([, y]) => y);

      if (triangle.key === 'water') {
        expect(heights).toEqual([TERRAIN_WATER_LEVEL_METERS, TERRAIN_WATER_LEVEL_METERS, TERRAIN_WATER_LEVEL_METERS].map(Math.fround));
      }
      else if (triangle.key === 'field' || triangle.key === 'fieldAlt') {
        expect(heights).toEqual([0, 0, 0]);
      }

      for (const height of heights) {
        highest = Math.max(highest, height);
        expect(height).toBeGreaterThanOrEqual(Math.fround(TERRAIN_WATER_LEVEL_METERS));
      }
    }

    expect(highest).toBeLessThanOrEqual(MAX_RELIEF_METERS);
    expect(highest).toBeGreaterThan(0.15);
  });

  it('faces every triangle up', () => {
    const isDownward = triangles.some((triangle) => {
      const normalY = (triangle.bz - triangle.az) * (triangle.cx - triangle.ax) - (triangle.bx - triangle.ax) * (triangle.cz - triangle.az);

      return normalY <= 0;
    });

    expect(isDownward).toBe(false);
  });

  it('keeps the strip along the world edge flat meadow without water, sand, fields or decor', () => {
    for (const triangle of triangles) {
      const corners = getCorners(triangle);

      if (corners.some(([x, , z]) => getEdgeDistance(x, z) < TERRAIN_EDGE_CLEAR_METERS)) {
        expect(['ground', 'groundAlt']).toContain(triangle.key);
      }

      for (const [x, y, z] of corners) {
        if (getEdgeDistance(x, z) <= TERRAIN_EDGE_CLEAR_METERS) {
          expect(y).toBe(0);
        }
      }
    }

    for (const decor of terrain.decor) {
      for (const point of getInstancePoints(decor)) {
        expect(getEdgeDistance(point.x, point.z)).toBeGreaterThanOrEqual(TERRAIN_EDGE_CLEAR_METERS);
      }
    }
  });

  it('sets decor on meadow ground at the interpolated height', () => {
    const landTriangles = triangles.filter(triangle => triangle.key === 'ground' || triangle.key === 'groundAlt');

    for (const decor of terrain.decor.filter(candidate => candidate.kind !== 'rock')) {
      const points = getInstancePoints(decor);
      const step = Math.max(1, Math.floor(points.length / 40));

      for (let index = 0; index < points.length; index += step) {
        const point = points[index];
        const triangle = point === undefined ? undefined : findGroundTriangle(landTriangles, point.x, point.z);

        expect(triangle).toBeDefined();

        if (point !== undefined && triangle !== undefined) {
          expect(point.y).toBeCloseTo(interpolateHeight(triangle, point.x, point.z) - TERRAIN_TREE_SINK_METERS, 2);
        }
      }
    }
  });

  it('puts rocks on meadow or sand and never into water or onto a field', () => {
    const rocks = terrain.decor.find(decor => decor.kind === 'rock');
    const solidTriangles = triangles.filter(triangle => triangle.key !== 'water');

    for (const point of rocks === undefined ? [] : getInstancePoints(rocks)) {
      const triangle = findGroundTriangle(solidTriangles, point.x, point.z);

      expect(triangle).toBeDefined();
      expect(triangle?.key).not.toBe('field');
      expect(triangle?.key).not.toBe('fieldAlt');
    }
  });
});

describe('generateWorldTerrain reserve', () => {
  it('keeps water, trees and rocks out of the reserve and flattens the ground inside it', () => {
    let reclaimedInstances = 0;
    let reclaimedWater = 0;

    for (const seed of SEEDS) {
      const free = generate(seed);
      const reserved = generate(seed, TEST_RESERVED);
      const reservedTriangles = collectTriangles(reserved);

      for (const triangle of reservedTriangles) {
        for (const [x, y, z] of getCorners(triangle)) {
          const distance = getReserveDistance(TEST_RESERVED, x, z);

          if (distance <= 0) {
            expect(y).toBe(0);
          }

          if (triangle.key === 'water') {
            expect(distance).toBeGreaterThan(0);
          }
        }
      }

      for (const decor of reserved.decor) {
        for (const point of getInstancePoints(decor)) {
          expect(getReserveDistance(TEST_RESERVED, point.x, point.z)).toBeGreaterThan(0);
        }
      }

      reclaimedInstances += free.decor
        .flatMap(decor => getInstancePoints(decor))
        .filter(point => getReserveDistance(TEST_RESERVED, point.x, point.z) <= 0).length;
      reclaimedWater += collectTriangles(free).filter(
        triangle => triangle.key === 'water' && getCorners(triangle).some(([x, , z]) => getReserveDistance(TEST_RESERVED, x, z) <= 0),
      ).length;
    }

    expect(reclaimedInstances).toBeGreaterThan(50);
    expect(reclaimedWater).toBeGreaterThan(0);
  });

  it('keeps the composition close to the free world, losing only what the reserve covers', () => {
    for (const seed of SEEDS) {
      const free = collectTriangles(generate(seed));
      const terrain = generate(seed, TEST_RESERVED);
      const triangles = collectTriangles(terrain);

      expect(getShare(triangles, ['water'])).toBeLessThanOrEqual(getShare(free, ['water']));
      expect(getShare(triangles, ['water'])).toBeLessThanOrEqual(0.14);
      expect(getShare(triangles, ['field', 'fieldAlt'])).toBeGreaterThanOrEqual(0.12);
      expect(terrain.forestShare).toBeGreaterThanOrEqual(0.1);
      expect(terrain.forestShare).toBeLessThanOrEqual(0.25);
    }
  });

  it('leaves the world outside the reserve and its fall-off exactly as it is without the reserve', () => {
    for (const seed of SEEDS) {
      const free = generate(seed);
      const reserved = generate(seed, TEST_RESERVED);

      const describeGround = (terrain: WorldTerrainValue): Map<string, string> => {
        const described = new Map<string, string>();

        for (const triangle of collectTriangles(terrain)) {
          const corners = getCorners(triangle);
          const centerX = corners.reduce((total, [x]) => total + x, 0) / 3;
          const centerZ = corners.reduce((total, [, , z]) => total + z, 0) / 3;

          if (getReserveDistance(TEST_RESERVED, centerX, centerZ) >= UNTOUCHED_DISTANCE_METERS) {
            described.set([centerX, centerZ].join(':'), [triangle.key, ...corners.map(([, y]) => y)].join(':'));
          }
        }

        return described;
      };

      const describeDecor = (terrain: WorldTerrainValue): Map<string, string> => {
        const described = new Map<string, string>();

        for (const decor of terrain.decor) {
          for (let instance = 0; instance < decor.ranks.length; instance += 1) {
            const x = decor.matrices[instance * 16 + 12] ?? 0;
            const z = decor.matrices[instance * 16 + 14] ?? 0;

            if (getReserveDistance(TEST_RESERVED, x, z) >= UNTOUCHED_DISTANCE_METERS) {
              described.set(
                [decor.kind, x, z].join(':'),
                [
                  ...decor.matrices.subarray(instance * 16, instance * 16 + 16),
                  ...decor.tints.subarray(instance * 3, instance * 3 + 3),
                  decor.ranks[instance],
                ].join(':'),
              );
            }
          }
        }

        return described;
      };

      const freeGround = describeGround(free);
      const freeDecor = describeDecor(free);

      expect(freeGround.size).toBeGreaterThan(5000);
      expect(freeDecor.size).toBeGreaterThan(300);
      expect(describeGround(reserved)).toEqual(freeGround);
      expect(describeDecor(reserved)).toEqual(freeDecor);
    }
  });
});

describe('generateWorldTerrain decor ranks', () => {
  const terrain = generate(2026);

  it('orders every decor array by rank and nests the quality levels', () => {
    for (const decor of terrain.decor) {
      const total = decor.ranks.length;
      const low = getDecorCountForDensity(decor.ranks, 0.3);
      const medium = getDecorCountForDensity(decor.ranks, 0.6);
      const high = getDecorCountForDensity(decor.ranks, 1);

      for (let index = 1; index < total; index += 1) {
        expect(decor.ranks[index] ?? 0).toBeGreaterThanOrEqual(decor.ranks[index - 1] ?? 0);
      }

      expect(decor.ranks[0] ?? 0).toBeGreaterThanOrEqual(0);
      expect(decor.ranks[total - 1] ?? 0).toBeLessThan(1);
      expect(low).toBeLessThanOrEqual(medium);
      expect(medium).toBeLessThanOrEqual(high);
      expect(high).toBe(total);

      if (total > 500) {
        expect(low / total).toBeGreaterThan(0.24);
        expect(low / total).toBeLessThan(0.36);
        expect(medium / total).toBeGreaterThan(0.54);
        expect(medium / total).toBeLessThan(0.66);
      }
    }
  });

  it('keeps tints within eight percent and matrices upright with the translation inside the world', () => {
    for (const decor of terrain.decor) {
      expect(decor.matrices.length).toBe(decor.ranks.length * 16);
      expect(decor.tints.length).toBe(decor.ranks.length * 3);

      for (const tint of decor.tints) {
        expect(tint).toBeGreaterThanOrEqual(0.92);
        expect(tint).toBeLessThanOrEqual(1.08);
      }

      for (const point of getInstancePoints(decor)) {
        expect(Math.abs(point.x)).toBeLessThan(HALF_WORLD);
        expect(Math.abs(point.z)).toBeLessThan(HALF_WORLD);
      }

      for (let instance = 0; instance < decor.ranks.length; instance += 1) {
        const offset = instance * 16;
        const cos = (decor.matrices[offset] ?? 0) / Math.hypot(decor.matrices[offset] ?? 0, decor.matrices[offset + 2] ?? 0);

        expect(decor.matrices[offset + 5] ?? 0).toBeGreaterThan(0);
        expect(decor.matrices[offset + 15]).toBe(1);
        expect(Math.abs(cos)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe.each(SEEDS)('generateWorldTerrain budgets, seed %i', (seed) => {
  const terrain = generate(seed, TEST_RESERVED);

  it('stays within the ground, group and decor budgets of the high quality level', () => {
    const trees = terrain.decor.filter(decor => decor.kind !== 'rock').reduce((total, decor) => total + decor.ranks.length, 0);
    const rocks = terrain.decor.find(decor => decor.kind === 'rock')?.ranks.length ?? 0;
    const groupedVertices = terrain.groundGroups.reduce((total, group) => total + group.count, 0);

    expect(terrain.triangleCount).toBeLessThanOrEqual(50000);
    expect(terrain.groundPositions.length).toBe(terrain.triangleCount * 9);
    expect(terrain.groundGroups.length).toBeLessThanOrEqual(7);
    expect(groupedVertices).toBe(terrain.triangleCount * 3);
    expect(trees).toBeLessThanOrEqual(4000);
    expect(rocks).toBeLessThanOrEqual(400);

    const decorDraws = terrain.decor.reduce((total, decor) => total + TERRAIN_DECOR_PARTS[decor.kind].length, 0);

    expect(decorDraws).toBeLessThanOrEqual(5);
    expect(terrain.groundGroups.length + decorDraws).toBeLessThanOrEqual(12);
  });

  it('lays the groups out back to back without gaps', () => {
    let expectedStart = 0;

    for (const group of terrain.groundGroups) {
      expect(group.start).toBe(expectedStart);
      expect(group.count % 3).toBe(0);
      expectedStart += group.count;
    }
  });
});
