import {
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { TerrainDecorValue } from '@/shared/3d';

import type { NetworkSceneBuildingValue } from '../layout';

import {
  BUILDING_BLOB_LIFT_METERS,
  BUILDING_BLOB_MARGIN_METERS,
  TREE_BLOB_CROWN_RADIUS_METERS,
  TREE_BLOB_LIFT_METERS,
  TREE_BLOB_RADIUS_SHARE,
} from './blobConstants';
import {
  buildBuildingBlobMatrices,
  buildTreeBlobs,
} from './buildBlobMatrices';
import { INSTANCE_MATRIX_ITEM_SIZE } from './composeInstanceMatrix';
import { PLAZA_HEIGHT_METERS } from './networkSceneMetrics';

const createBuilding = (overrides: Partial<NetworkSceneBuildingValue>): NetworkSceneBuildingValue => ({
  cityId: 'city',
  depth: 3,
  height: 2,
  id: 'house',
  isCompany: false,
  isOwn: false,
  kind: 'house',
  rank: 0,
  rotation: 0,
  side: undefined,
  siteId: undefined,
  width: 4,
  x: 5,
  z: -4,
  ...overrides,
});

const createDecorLayer = (
  kind: TerrainDecorValue['kind'],
  trees: readonly { rank: number; scale: number; x: number; y: number; z: number }[],
): TerrainDecorValue => {
  const matrices = new Float32Array(trees.length * INSTANCE_MATRIX_ITEM_SIZE);

  trees.forEach((tree, index) => {
    new Matrix4()
      .compose(new Vector3(tree.x, tree.y, tree.z), new Quaternion(), new Vector3(tree.scale, tree.scale, tree.scale))
      .toArray(matrices, index * INSTANCE_MATRIX_ITEM_SIZE);
  });

  return {
    kind,
    matrices,
    ranks: Float32Array.from(trees.map(tree => tree.rank)),
    tints: new Float32Array(trees.length * 3),
  };
};

const readTranslation = (matrices: Float32Array, index: number): number[] => new Vector3()
  .fromArray(matrices, index * INSTANCE_MATRIX_ITEM_SIZE + 12)
  .toArray();

const readSize = (matrices: Float32Array, index: number): { x: number; y: number; z: number } => {
  const matrix = new Matrix4().fromArray(matrices, index * INSTANCE_MATRIX_ITEM_SIZE);
  const scale = new Vector3().setFromMatrixScale(matrix);

  return { x: scale.x, y: scale.y, z: scale.z };
};

describe('buildBuildingBlobMatrices', () => {
  it('stands a blob under every building above the plaza with a margin on each side', () => {
    const matrices = buildBuildingBlobMatrices([createBuilding({ depth: 3, width: 4, x: 5, z: -4 })]);
    const size = readSize(matrices, 0);

    expect(matrices).toHaveLength(INSTANCE_MATRIX_ITEM_SIZE);
    expect(size.x).toBeCloseTo(4 + 2 * BUILDING_BLOB_MARGIN_METERS, 5);
    expect(size.y).toBeCloseTo(1, 5);
    expect(size.z).toBeCloseTo(3 + 2 * BUILDING_BLOB_MARGIN_METERS, 5);
    expect(readTranslation(matrices, 0)[0]).toBeCloseTo(5, 5);
    expect(readTranslation(matrices, 0)[1]).toBeCloseTo(PLAZA_HEIGHT_METERS + BUILDING_BLOB_LIFT_METERS, 5);
    expect(readTranslation(matrices, 0)[2]).toBeCloseTo(-4, 5);
  });

  it('turns the blob together with the building', () => {
    const rotation = Math.PI / 3;
    const matrices = buildBuildingBlobMatrices([createBuilding({ rotation })]);
    const quaternion = new Quaternion();

    new Matrix4().fromArray(matrices, 0).decompose(new Vector3(), quaternion, new Vector3());

    expect(2 * Math.atan2(quaternion.y, quaternion.w)).toBeCloseTo(rotation, 5);
  });

  it('keeps the order of the buildings so the visible count matches the buildings layer', () => {
    const matrices = buildBuildingBlobMatrices([createBuilding({ x: 1 }), createBuilding({ x: 2 }), createBuilding({ x: 3 })]);

    expect(matrices).toHaveLength(3 * INSTANCE_MATRIX_ITEM_SIZE);
    expect([0, 1, 2].map(index => readTranslation(matrices, index)[0])).toEqual([1, 2, 3]);
  });

  it('returns an empty buffer for no buildings', () => {
    expect(buildBuildingBlobMatrices([])).toHaveLength(0);
  });
});

describe('buildTreeBlobs', () => {
  it('sorts the blobs of all tree layers by rank', () => {
    const decor = [
      createDecorLayer('deciduous', [
        { rank: 0.2, scale: 1, x: 1, y: 0, z: 0 },
        { rank: 0.8, scale: 1, x: 2, y: 0, z: 0 },
      ]),
      createDecorLayer('conifer', [
        { rank: 0.1, scale: 1, x: 3, y: 0, z: 0 },
        { rank: 0.5, scale: 1, x: 4, y: 0, z: 0 },
      ]),
    ];
    const { matrices, ranks } = buildTreeBlobs(decor);

    expect(Array.from(ranks)).toEqual([
      Math.fround(0.1),
      Math.fround(0.2),
      Math.fround(0.5),
      Math.fround(0.8),
    ]);
    expect([0, 1, 2, 3].map(index => readTranslation(matrices, index)[0])).toEqual([3, 1, 4, 2]);
  });

  it('sizes a blob from the crown radius and the scale of the tree and lifts it above the ground', () => {
    const decor = [createDecorLayer('conifer', [{ rank: 0.3, scale: 1.5, x: 7, y: 0.25, z: -2 }])];
    const { matrices } = buildTreeBlobs(decor);
    const size = readSize(matrices, 0);
    const expectedDiameter = 2 * TREE_BLOB_CROWN_RADIUS_METERS.conifer * 1.5 * TREE_BLOB_RADIUS_SHARE;

    expect(size.x).toBeCloseTo(expectedDiameter, 5);
    expect(size.z).toBeCloseTo(expectedDiameter, 5);
    expect(readTranslation(matrices, 0)).toEqual([
      Math.fround(7),
      Math.fround(0.25 + TREE_BLOB_LIFT_METERS),
      Math.fround(-2),
    ]);
  });

  it('gives deciduous crowns a wider blob than conifers of the same scale', () => {
    const conifer = buildTreeBlobs([createDecorLayer('conifer', [{ rank: 0, scale: 1, x: 0, y: 0, z: 0 }])]);
    const deciduous = buildTreeBlobs([createDecorLayer('deciduous', [{ rank: 0, scale: 1, x: 0, y: 0, z: 0 }])]);

    expect(readSize(deciduous.matrices, 0).x).toBeGreaterThan(readSize(conifer.matrices, 0).x);
  });

  it('skips rocks', () => {
    const decor = [
      createDecorLayer('rock', [{ rank: 0.1, scale: 1, x: 1, y: 0, z: 1 }]),
      createDecorLayer('deciduous', [{ rank: 0.4, scale: 1, x: 2, y: 0, z: 2 }]),
    ];
    const { matrices, ranks } = buildTreeBlobs(decor);

    expect(ranks).toHaveLength(1);
    expect(matrices).toHaveLength(INSTANCE_MATRIX_ITEM_SIZE);
    expect(readTranslation(matrices, 0)[0]).toBe(2);
  });

  it('returns empty buffers when there are no trees', () => {
    const { matrices, ranks } = buildTreeBlobs([createDecorLayer('rock', [{ rank: 0, scale: 1, x: 0, y: 0, z: 0 }])]);

    expect(matrices).toHaveLength(0);
    expect(ranks).toHaveLength(0);
  });
});
