import {
  describe,
  expect,
  it,
} from 'vitest';

import { hashUnit } from './terrainHash';
import {
  createNoiseField,
  sampleNoiseField,
} from './terrainNoise';

const BOUNDS = { maxX: 96, maxZ: 96, minX: -96, minZ: -96 };

describe('hashUnit', () => {
  it('spreads integer lattice points evenly over the unit interval', () => {
    const buckets = new Array<number>(16).fill(0);

    for (let x = -32; x < 32; x += 1) {
      for (let y = -32; y < 32; y += 1) {
        const bucket = Math.floor(hashUnit(7, x, y, 3) * 16);
        buckets[bucket] = (buckets[bucket] ?? 0) + 1;
      }
    }

    for (const count of buckets) {
      expect(count).toBeGreaterThan(190);
      expect(count).toBeLessThan(322);
    }
  });

  it('gives a different value for a different seed, salt or coordinate and the same value for the same input', () => {
    const base = hashUnit(7, 3, 4, 5);

    expect(hashUnit(7, 3, 4, 5)).toBe(base);
    expect(hashUnit(8, 3, 4, 5)).not.toBe(base);
    expect(hashUnit(7, 3, 4, 6)).not.toBe(base);
    expect(hashUnit(7, 4, 3, 5)).not.toBe(base);
  });
});

describe('createNoiseField', () => {
  const field = createNoiseField({ bounds: BOUNDS, featureMeters: 40, octaves: 3, salt: 1, seed: 11 });

  it('stays inside the unit interval and varies over the world', () => {
    let min = 1;
    let max = 0;

    for (let x = -96; x <= 96; x += 3) {
      for (let z = -96; z <= 96; z += 3) {
        const value = sampleNoiseField(field, x, z);
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }

    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(0.3);
  });

  it('is continuous: a small step changes the value only a little', () => {
    for (let x = -90; x <= 90; x += 7.3) {
      for (let z = -90; z <= 90; z += 7.7) {
        const step = Math.abs(sampleNoiseField(field, x + 0.1, z) - sampleNoiseField(field, x, z));

        expect(step).toBeLessThan(0.03);
      }
    }
  });

  it('does not depend on the bounds it was created for', () => {
    const wider = createNoiseField({
      bounds: { maxX: 300, maxZ: 300, minX: -300, minZ: -300 },
      featureMeters: 40,
      octaves: 3,
      salt: 1,
      seed: 11,
    });

    expect(sampleNoiseField(wider, 12.5, -31.25)).toBeCloseTo(sampleNoiseField(field, 12.5, -31.25), 9);
  });
});
