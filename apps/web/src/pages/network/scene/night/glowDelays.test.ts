import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  clampUnit,
  computeLampDelay,
  computeWindowDelay,
  getFarthestCityDistance,
  toDistanceUnit,
} from './glowDelays';

describe('glowDelays', () => {
  it('puts the lamp delay between 0.35 and 0.58 by the distance and the hash', () => {
    expect(computeLampDelay({ distanceUnit: 0, hashUnit: 0 })).toBeCloseTo(0.35, 9);
    expect(computeLampDelay({ distanceUnit: 1, hashUnit: 1 })).toBeCloseTo(0.58, 9);
    expect(computeLampDelay({ distanceUnit: 1, hashUnit: 0 })).toBeCloseTo(0.35 + 0.7 * 0.23, 9);
    expect(computeLampDelay({ distanceUnit: 0, hashUnit: 1 })).toBeCloseTo(0.35 + 0.3 * 0.23, 9);
    expect(computeLampDelay({ distanceUnit: 5, hashUnit: 5 })).toBeCloseTo(0.58, 9);
  });

  it('puts the window delay between 0.45 and 0.83 by the city, the place in the city and the hash', () => {
    expect(computeWindowDelay({ cityUnit: 0, hashUnit: 0, localUnit: 0 })).toBeCloseTo(0.45, 9);
    expect(computeWindowDelay({ cityUnit: 1, hashUnit: 1, localUnit: 1 })).toBeCloseTo(0.83, 9);
    expect(computeWindowDelay({ cityUnit: 1, hashUnit: 0, localUnit: 0 })).toBeCloseTo(0.45 + 0.6 * 0.38, 9);
    expect(computeWindowDelay({ cityUnit: 0, hashUnit: 0, localUnit: 1 })).toBeCloseTo(0.45 + 0.25 * 0.38, 9);
    expect(computeWindowDelay({ cityUnit: 0, hashUnit: 1, localUnit: 0 })).toBeCloseTo(0.45 + 0.15 * 0.38, 9);
    expect(computeWindowDelay({ cityUnit: -3, hashUnit: -3, localUnit: -3 })).toBeCloseTo(0.45, 9);
  });

  it('measures distances from the map center against the farthest city', () => {
    const farthest = getFarthestCityDistance([{ x: 30, z: 40 }, { x: -3, z: 4 }]);

    expect(farthest).toBe(50);
    expect(toDistanceUnit(25, farthest)).toBe(0.5);
    expect(toDistanceUnit(80, farthest)).toBe(1);
    expect(getFarthestCityDistance([])).toBeGreaterThan(0);
    expect(clampUnit(-1)).toBe(0);
  });
});
