import {
  describe,
  expect,
  it,
} from 'vitest';

import { createGablePrismGeometry } from './createGablePrismGeometry';

describe('createGablePrismGeometry', () => {
  it('fits the unit footprint with the ridge on top of the middle line', () => {
    const geometry = createGablePrismGeometry();
    geometry.computeBoundingBox();

    expect(geometry.boundingBox?.min.toArray()).toEqual([-0.5, 0, -0.5]);
    expect(geometry.boundingBox?.max.toArray()).toEqual([0.5, 1, 0.5]);
    expect(geometry.getAttribute('position').count).toBe(18);
  });

  it('faces every triangle away from the inside of the prism', () => {
    const geometry = createGablePrismGeometry();
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

  it('keeps the two slopes inclined and the two ends vertical', () => {
    const normals = createGablePrismGeometry().getAttribute('normal');
    const horizontalCount = Array.from({ length: normals.count }, (_, index) => Math.abs(normals.getY(index)))
      .filter(normalY => normalY < 1e-9).length;

    expect(horizontalCount).toBe(6);
  });
});
