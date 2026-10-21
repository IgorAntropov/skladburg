import {
  Matrix4,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkSceneBuildingValue } from '../layout';

import { getVisibleBuildingCount } from '../layout';
import { buildBuildingParts } from './buildBuildingParts';

const createBuilding = (overrides: Partial<NetworkSceneBuildingValue>): NetworkSceneBuildingValue => ({
  cityId: 'city',
  depth: 1.2,
  height: 1.4,
  id: 'building',
  isCompany: false,
  isOwn: false,
  kind: 'house',
  rank: 0.5,
  rotation: 0,
  side: undefined,
  siteId: undefined,
  width: 1.4,
  x: 10,
  z: -6,
  ...overrides,
});

const BUILDINGS: readonly NetworkSceneBuildingValue[] = [
  createBuilding({
    depth: 1.5,
    height: 1.5,
    id: 'warehouse',
    isCompany: true,
    kind: 'warehouse',
    rank: 0,
    side: 'customer',
    siteId: 'warehouse',
    width: 2,
  }),
  createBuilding({ id: 'house-a', kind: 'house', rank: 0.1 }),
  createBuilding({ height: 1.8, id: 'office-a', kind: 'office', rank: 0.2 }),
  createBuilding({ id: 'house-b', kind: 'house', rank: 0.6 }),
];

const readMatrix = (matrices: Float32Array, index: number): Matrix4 => new Matrix4().fromArray(matrices, index * 16);

const findPart = (key: string): ReturnType<typeof buildBuildingParts>[number] => {
  const part = buildBuildingParts(BUILDINGS).find(candidate => candidate.key === key);

  if (part === undefined) {
    throw new Error(`No building part ${key}`);
  }

  return part;
};

describe('buildBuildingParts', () => {
  it('splits the buildings into the five material parts', () => {
    const parts = buildBuildingParts(BUILDINGS);

    expect(parts.map(part => [part.key, part.items.map(item => item.id)])).toEqual([
      ['buildingWall', ['house-a', 'office-a', 'house-b']],
      ['warehouseWall', ['warehouse']],
      ['buildingRoof', ['house-a', 'house-b']],
      ['buildingRoofAlt', ['office-a']],
      ['warehouseRoof', ['warehouse']],
    ]);
    expect(parts.every(part => part.matrices.length === part.items.length * 16 && part.tints.length === part.items.length * 3)).toBe(true);
  });

  it('puts the walls on the plaza with the height under the roof', () => {
    const house = readMatrix(findPart('buildingWall').matrices, 0);
    const office = readMatrix(findPart('buildingWall').matrices, 1);
    const scale = (matrix: Matrix4): Vector3 => new Vector3().setFromMatrixScale(matrix);
    const position = (matrix: Matrix4): Vector3 => new Vector3().setFromMatrixPosition(matrix);

    expect(position(house).x).toBeCloseTo(10, 5);
    expect(position(house).y).toBeCloseTo(0.1, 5);
    expect(position(house).z).toBeCloseTo(-6, 5);
    expect(scale(house).y).toBeCloseTo(0.9, 6);
    expect(scale(office).y).toBeCloseTo(1.7, 6);
  });

  it('puts the gable roof on top of the walls and the flat roof of the office as a thin slab', () => {
    const roof = readMatrix(findPart('buildingRoof').matrices, 0);
    const slab = readMatrix(findPart('buildingRoofAlt').matrices, 0);

    expect(new Vector3().setFromMatrixPosition(roof).y).toBeCloseTo(0.1 + 0.9, 6);
    expect(new Vector3().setFromMatrixScale(roof).y).toBeCloseTo(0.5, 6);
    expect(new Vector3().setFromMatrixPosition(slab).y).toBeCloseTo(0.1 + 1.7, 6);
    expect(new Vector3().setFromMatrixScale(slab).y).toBeCloseTo(0.1, 6);
  });

  it('runs the ridge along the longer side', () => {
    const readRidgeOffset = (building: NetworkSceneBuildingValue): Vector3 => {
      const roof = buildBuildingParts([building]).find(part => part.key === 'buildingRoof');
      const matrix = readMatrix(roof?.matrices ?? new Float32Array(16), 0);
      const center = new Vector3().setFromMatrixPosition(matrix);

      return new Vector3(0.5, 1, 0).applyMatrix4(matrix).sub(center).setY(0);
    };

    const wide = readRidgeOffset(createBuilding({ depth: 1, rotation: 0, width: 1.5 }));
    const deep = readRidgeOffset(createBuilding({ depth: 1.5, rotation: 0, width: 1 }));
    const turnedWide = readRidgeOffset(createBuilding({ depth: 1, rotation: Math.PI / 2, width: 1.5 }));

    expect([Math.abs(wide.x), Math.abs(wide.z)]).toEqual([expect.closeTo(0.75, 6), expect.closeTo(0, 6)]);
    expect([Math.abs(deep.x), Math.abs(deep.z)]).toEqual([expect.closeTo(0, 6), expect.closeTo(0.75, 6)]);
    expect([Math.abs(turnedWide.x), Math.abs(turnedWide.z)]).toEqual([expect.closeTo(0, 6), expect.closeTo(0.75, 6)]);
  });

  it('keeps the tint of houses and offices in a narrow range and the warehouse untinted', () => {
    const parts = buildBuildingParts(Array.from({ length: 30 }, (_, index) => createBuilding({ id: ['house', String(index)].join('-') })));
    const walls = parts.find(part => part.key === 'buildingWall')?.tints ?? new Float32Array(0);
    const roofs = parts.find(part => part.key === 'buildingRoof')?.tints ?? new Float32Array(0);

    expect(Math.min(...walls)).toBeGreaterThanOrEqual(0.94 - 1e-6);
    expect(Math.max(...walls)).toBeLessThanOrEqual(1 + 1e-6);
    expect(Math.min(...roofs)).toBeGreaterThanOrEqual(0.92 - 1e-6);
    expect(new Set(walls).size).toBeGreaterThan(5);
    expect([...findPart('warehouseWall').tints]).toEqual([1, 1, 1]);
    expect([...findPart('warehouseRoof').tints]).toEqual([1, 1, 1]);
  });

  it('gives the same tint for the same building however the others are ordered', () => {
    const forward = buildBuildingParts(BUILDINGS).find(part => part.key === 'buildingRoof');
    const reversed = buildBuildingParts(BUILDINGS.toReversed()).find(part => part.key === 'buildingRoof');

    expect(forward?.tints[0]).toBe(reversed?.tints[3]);
    expect(forward?.tints[3]).toBe(reversed?.tints[0]);
  });

  it('keeps the visible instances of every part a prefix of the density order', () => {
    const parts = buildBuildingParts(BUILDINGS);

    expect(parts.map(part => getVisibleBuildingCount(part.items, 0.15))).toEqual([1, 1, 1, 0, 1]);
    expect(parts.map(part => getVisibleBuildingCount(part.items, 1))).toEqual([3, 1, 2, 1, 1]);
  });
});
