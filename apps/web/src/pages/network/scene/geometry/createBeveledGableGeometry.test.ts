import {
  describe,
  expect,
  it,
} from 'vitest';

import { createBeveledGableGeometry } from './createBeveledGableGeometry';

const OPTIONS = { bevel: 0.05, eaveShade: 0.8, segments: 1, shadeHeight: 0.6 } as const;
const EPSILON = 1e-6;

describe('createBeveledGableGeometry', () => {
  it('fits the unit footprint with the ridge on top of the middle line along X', () => {
    for (const segments of [1, 2]) {
      const geometry = createBeveledGableGeometry({ ...OPTIONS, segments });
      const position = geometry.getAttribute('position');
      geometry.computeBoundingBox();

      expect(geometry.boundingBox?.min.x).toBeCloseTo(-0.5, 6);
      expect(geometry.boundingBox?.max.x).toBeCloseTo(0.5, 6);
      expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 6);
      expect(geometry.boundingBox?.max.y).toBeCloseTo(1, 6);
      expect(geometry.boundingBox?.min.z).toBeCloseTo(-0.5, 6);
      expect(geometry.boundingBox?.max.z).toBeCloseTo(0.5, 6);

      for (let index = 0; index < position.count; index += 1) {
        if (position.getY(index) > 1 - EPSILON) {
          expect(Math.abs(position.getZ(index))).toBeLessThan(EPSILON);
        }
      }
    }
  });

  it('faces every triangle away from the inside of the prism', () => {
    const geometry = createBeveledGableGeometry(OPTIONS);
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const inside = { x: 0, y: 0.3, z: 0 };

    for (let triangle = 0; triangle < positions.count / 3; triangle += 1) {
      const first = triangle * 3;
      const centerX = (positions.getX(first) + positions.getX(first + 1) + positions.getX(first + 2)) / 3;
      const centerY = (positions.getY(first) + positions.getY(first + 1) + positions.getY(first + 2)) / 3;
      const centerZ = (positions.getZ(first) + positions.getZ(first + 1) + positions.getZ(first + 2)) / 3;
      const alignment = normals.getX(first) * (centerX - inside.x)
        + normals.getY(first) * (centerY - inside.y)
        + normals.getZ(first) * (centerZ - inside.z);

      expect(alignment).toBeGreaterThan(0);
    }
  });

  it('darkens the vertices toward the eaves from the full tone at the ridge', () => {
    const geometry = createBeveledGableGeometry(OPTIONS);
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const shades = Array.from({ length: position.count }, (_, index) => ({ shade: color.getX(index), y: position.getY(index) }))
      .toSorted((current, prev) => current.y - prev.y);

    expect(shades[0]?.shade).toBeCloseTo(OPTIONS.eaveShade, 6);
    expect(shades.at(-1)?.shade).toBeCloseTo(1, 6);

    for (const [index, current] of shades.entries()) {
      expect(current.shade).toBeGreaterThanOrEqual((shades[index - 1]?.shade ?? 0) - EPSILON);
    }
  });
});
