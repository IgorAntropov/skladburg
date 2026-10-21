import {
  describe,
  expect,
  it,
} from 'vitest';

import { createOwnMarkerGeometries } from './createOwnMarkerGeometry';

describe('createOwnMarkerGeometries', () => {
  it('makes a 1.1 m house on top of a 1.34 m outline of the same shape', () => {
    const { house, outline } = createOwnMarkerGeometries();

    house.computeBoundingBox();
    outline.computeBoundingBox();

    const houseBox = house.boundingBox;
    const outlineBox = outline.boundingBox;

    expect(((houseBox?.max.x ?? 0) - (houseBox?.min.x ?? 0))).toBeCloseTo(0.92 * 1.1, 6);
    expect(((houseBox?.max.y ?? 0) - (houseBox?.min.y ?? 0))).toBeCloseTo(0.97 * 1.1, 6);
    expect(((outlineBox?.max.x ?? 0) - (outlineBox?.min.x ?? 0))).toBeCloseTo(0.92 * 1.34, 6);
  });

  it('keeps the house upright: the roof peak is on top', () => {
    const { house } = createOwnMarkerGeometries();

    house.computeBoundingBox();

    const positions = house.getAttribute('position');
    let topX = 0;
    let topY = -Infinity;

    for (let index = 0; index < positions.count; index += 1) {
      if (positions.getY(index) > topY) {
        topY = positions.getY(index);
        topX = positions.getX(index);
      }
    }

    expect(topX).toBeCloseTo(0, 6);
    expect(topY).toBeCloseTo(0.47 * 1.1, 6);
  });

  it('puts the front of the house at 0.30 m and the front of the outline at 0.26 m, both over the chip', () => {
    const { house, outline } = createOwnMarkerGeometries();

    house.computeBoundingBox();
    outline.computeBoundingBox();

    expect(house.boundingBox?.max.z).toBeCloseTo(0.3, 6);
    expect(house.boundingBox?.min.z).toBeCloseTo(0.26, 6);
    expect(outline.boundingBox?.max.z).toBeCloseTo(0.26, 6);
    expect(outline.boundingBox?.min.z).toBeCloseTo(0.2, 6);
  });
});
