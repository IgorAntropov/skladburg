import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  BUILDING_BLOB_OPTIONS,
  TREE_BLOB_OPTIONS,
} from './blobConstants';
import { createSoftBlobGeometry } from './createSoftBlobGeometry';

const readAlphas = (colors: ArrayLike<number>): number[] => {
  const alphas: number[] = [];

  for (let index = 3; index < colors.length; index += 4) {
    alphas.push(colors[index] ?? Number.NaN);
  }

  return alphas;
};

describe('createSoftBlobGeometry', () => {
  it('builds one center vertex and one ring of segments per radius share', () => {
    const { radiusShares, segments } = BUILDING_BLOB_OPTIONS;
    const geometry = createSoftBlobGeometry(BUILDING_BLOB_OPTIONS);
    const expectedVertexCount = 1 + radiusShares.length * segments;
    const expectedTriangleCount = segments + (radiusShares.length - 1) * segments * 2;

    expect(geometry.getAttribute('position').count).toBe(expectedVertexCount);
    expect(geometry.getAttribute('color').count).toBe(expectedVertexCount);
    expect(geometry.getIndex()?.count).toBe(expectedTriangleCount * 3);
  });

  it('builds the smaller blob for trees with two rings', () => {
    const geometry = createSoftBlobGeometry(TREE_BLOB_OPTIONS);

    expect(geometry.getAttribute('position').count).toBe(1 + 2 * TREE_BLOB_OPTIONS.segments);
    expect(geometry.getIndex()?.count).toBe((TREE_BLOB_OPTIONS.segments + TREE_BLOB_OPTIONS.segments * 2) * 3);
  });

  it('writes the alpha of the center first and then of each ring in the given order', () => {
    const geometry = createSoftBlobGeometry(BUILDING_BLOB_OPTIONS);
    const alphas = readAlphas(geometry.getAttribute('color').array);
    const { alphas: expected, segments } = BUILDING_BLOB_OPTIONS;

    expect(alphas[0]).toBeCloseTo(expected[0] ?? Number.NaN, 6);
    expected.slice(1).forEach((alpha, ringIndex) => {
      alphas.slice(1 + ringIndex * segments, 1 + (ringIndex + 1) * segments).forEach((ringAlpha) => {
        expect(ringAlpha).toBeCloseTo(alpha, 6);
      });
    });
  });

  it('keeps every index inside the vertices and every triangle non-degenerate', () => {
    const geometry = createSoftBlobGeometry(BUILDING_BLOB_OPTIONS);
    const indices = Array.from(geometry.getIndex()?.array ?? []);
    const vertexCount = geometry.getAttribute('position').count;

    expect(Math.max(...indices)).toBeLessThan(vertexCount);
    expect(Math.min(...indices)).toBeGreaterThanOrEqual(0);

    for (let offset = 0; offset < indices.length; offset += 3) {
      expect(new Set(indices.slice(offset, offset + 3)).size).toBe(3);
    }
  });

  it('lies flat on the ground within the unit square scaled by the outer share', () => {
    const geometry = createSoftBlobGeometry(BUILDING_BLOB_OPTIONS);
    const positions = geometry.getAttribute('position');

    for (let index = 0; index < positions.count; index += 1) {
      expect(positions.getY(index)).toBe(0);
      expect(Math.abs(positions.getX(index))).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(positions.getZ(index))).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('winds every triangle upward so the blob is visible from above', () => {
    const geometry = createSoftBlobGeometry(TREE_BLOB_OPTIONS);
    const positions = geometry.getAttribute('position');
    const indices = Array.from(geometry.getIndex()?.array ?? []);

    for (let offset = 0; offset < indices.length; offset += 3) {
      const [first = 0, second = 0, third = 0] = indices.slice(offset, offset + 3);
      const ax = positions.getX(second) - positions.getX(first);
      const az = positions.getZ(second) - positions.getZ(first);
      const bx = positions.getX(third) - positions.getX(first);
      const bz = positions.getZ(third) - positions.getZ(first);

      expect(bx * az - bz * ax).toBeGreaterThan(0);
    }
  });
});
