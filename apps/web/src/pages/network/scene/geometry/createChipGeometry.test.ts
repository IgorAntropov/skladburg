import {
  describe,
  expect,
  it,
} from 'vitest';

import { SIDE_SHAPES } from '@/entities/organization';

import { createChipGeometries } from './createChipGeometry';

const measure = (side: keyof typeof SIDE_SHAPES): { body: number[]; rim: number[] } => {
  const { body, rim } = createChipGeometries(SIDE_SHAPES[side].outline);

  body.computeBoundingBox();
  rim.computeBoundingBox();

  return {
    body: [...(body.boundingBox?.min.toArray() ?? []), ...(body.boundingBox?.max.toArray() ?? [])],
    rim: [...(rim.boundingBox?.min.toArray() ?? []), ...(rim.boundingBox?.max.toArray() ?? [])],
  };
};

describe('createChipGeometries', () => {
  it('makes the customer body a 1.8 m circle and the carrier body a capsule of 1:0.72', () => {
    const customer = measure('customer').body;
    const carrier = measure('carrier').body;

    expect((customer[3] ?? 0) - (customer[0] ?? 0)).toBeCloseTo(1.8, 2);
    expect((customer[4] ?? 0) - (customer[1] ?? 0)).toBeCloseTo(1.8, 2);
    expect((carrier[3] ?? 0) - (carrier[0] ?? 0)).toBeCloseTo(1.8, 2);
    expect((carrier[4] ?? 0) - (carrier[1] ?? 0)).toBeCloseTo(1.296, 2);
  });

  it('keeps the shape upright: the supplier roof peak is on top', () => {
    const supplier = createChipGeometries(SIDE_SHAPES.supplier.outline).body;
    const positions = supplier.getAttribute('position');
    let topY = -Infinity;
    let topX = 0;

    for (let index = 0; index < positions.count; index += 1) {
      if (positions.getY(index) > topY) {
        topY = positions.getY(index);
        topX = positions.getX(index);
      }
    }

    expect(topY).toBeCloseTo(0.9, 2);
    expect(topX).toBeCloseTo(0, 2);
  });

  it('puts the body between z 0 and 0.20 and the rim 1.18 times wider between z -0.10 and 0.18', () => {
    const { body, rim } = measure('customer');

    expect(body[2]).toBeCloseTo(0, 6);
    expect(body[5]).toBeCloseTo(0.2, 6);
    expect(rim[2]).toBeCloseTo(-0.1, 6);
    expect(rim[5]).toBeCloseTo(0.18, 6);
    expect((rim[3] ?? 0) - (rim[0] ?? 0)).toBeCloseTo(1.8 * 1.18, 2);
  });

  it('wraps the whole body with the rim for every side', () => {
    for (const side of ['carrier', 'customer', 'supplier'] as const) {
      const { body, rim } = measure(side);

      expect(rim[0]).toBeLessThan(body[0] ?? 0);
      expect(rim[1]).toBeLessThan(body[1] ?? 0);
      expect(rim[3]).toBeGreaterThan(body[3] ?? 0);
      expect(rim[4]).toBeGreaterThan(body[4] ?? 0);
    }
  });
});
