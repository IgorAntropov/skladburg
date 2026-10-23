import type { BufferGeometry } from 'three';

import {
  describe,
  expect,
  it,
} from 'vitest';

import { createBeveledBoxGeometry } from './createBeveledBoxGeometry';

const OPTIONS = { bottomShade: 0.6, radii: { x: 0.07, y: 0.06, z: 0.07 }, segments: 1, shadeHeight: 0.5 } as const;
const EPSILON = 1e-6;

const measureShadeByHeight = (geometry: BufferGeometry): { shade: number; y: number }[] => {
  const position = geometry.getAttribute('position');
  const color = geometry.getAttribute('color');

  return Array.from({ length: position.count }, (_, index) => ({ shade: color.getX(index), y: position.getY(index) }))
    .toSorted((current, prev) => current.y - prev.y);
};

describe('createBeveledBoxGeometry', () => {
  it('fits the unit box standing on the ground', () => {
    for (const segments of [1, 2]) {
      const geometry = createBeveledBoxGeometry({ ...OPTIONS, segments });
      geometry.computeBoundingBox();

      expect(geometry.boundingBox?.min.x).toBeCloseTo(-0.5, 6);
      expect(geometry.boundingBox?.max.x).toBeCloseTo(0.5, 6);
      expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 6);
      expect(geometry.boundingBox?.max.y).toBeCloseTo(1, 6);
      expect(geometry.boundingBox?.min.z).toBeCloseTo(-0.5, 6);
      expect(geometry.boundingBox?.max.z).toBeCloseTo(0.5, 6);
    }
  });

  it('has more triangles for more segments', () => {
    const coarse = createBeveledBoxGeometry({ ...OPTIONS, segments: 1 });
    const fine = createBeveledBoxGeometry({ ...OPTIONS, segments: 2 });

    expect(fine.getAttribute('position').count).toBeGreaterThan(coarse.getAttribute('position').count);
  });

  it('darkens the vertices toward the ground from the full tone at the top', () => {
    const shades = measureShadeByHeight(createBeveledBoxGeometry(OPTIONS));
    const [first] = shades;
    const last = shades.at(-1);

    expect(first?.shade).toBeCloseTo(OPTIONS.bottomShade, 6);
    expect(last?.shade).toBeCloseTo(1, 6);

    for (const [index, current] of shades.entries()) {
      expect(current.shade).toBeGreaterThanOrEqual((shades[index - 1]?.shade ?? 0) - EPSILON);
    }
  });

  it('paints the same shade to all three channels of a vertex', () => {
    const color = createBeveledBoxGeometry(OPTIONS).getAttribute('color');

    expect(color.itemSize).toBe(3);
    expect(color.getY(0)).toBe(color.getX(0));
    expect(color.getZ(0)).toBe(color.getX(0));
  });
});
