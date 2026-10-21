import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  compareIds,
  hashIndex,
  hashUnit,
  lerpRange,
} from './layoutHash';

describe('layout hash', () => {
  it('gives the same unit for the same seed, key and salt', () => {
    expect(hashUnit(7, 'warehouse-1', 3)).toBe(hashUnit(7, 'warehouse-1', 3));
  });

  it('keeps units in [0, 1) and spreads different keys and salts', () => {
    const units = Array.from({ length: 200 }, (_, index) => hashUnit(20261013, ['key', String(index)].join('-'), 1));

    expect(units.every(unit => unit >= 0 && unit < 1)).toBe(true);
    expect(new Set(units).size).toBe(units.length);
    expect(hashUnit(1, 'key', 1)).not.toBe(hashUnit(1, 'key', 2));
    expect(hashUnit(1, 'key', 1)).not.toBe(hashUnit(2, 'key', 1));

    const mean = units.reduce((sum, unit) => sum + unit, 0) / units.length;

    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
  });

  it('keeps indexes inside the size', () => {
    const indexes = Array.from({ length: 300 }, (_, index) => hashIndex(5, ['key', String(index)].join('-'), 2, 13));

    expect(indexes.every(index => Number.isInteger(index) && index >= 0 && index < 13)).toBe(true);
    expect(new Set(indexes).size).toBeGreaterThan(8);
  });

  it('interpolates inside a range', () => {
    expect(lerpRange([2, 4], 0)).toBe(2);
    expect(lerpRange([2, 4], 0.5)).toBe(3);
  });

  it('compares ids by code units', () => {
    expect(compareIds('a', 'b')).toBe(-1);
    expect(compareIds('b', 'a')).toBe(1);
    expect(compareIds('a', 'a')).toBe(0);
  });
});
