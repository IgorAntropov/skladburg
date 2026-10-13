import {
  describe,
  expect,
  it,
} from 'vitest';

import type { TerrainReservedValue } from './terrainTypes';

import {
  EMPTY_TERRAIN_RESERVED,
  getReserveDistance,
} from './terrainReserve';

const RESERVED: TerrainReservedValue = {
  areas: [{ radius: 10, x: 0, z: 0 }],
  corridors: [
    {
      points: [
        { x: 20, z: 0 },
        { x: 20, z: 40 },
        { x: 60, z: 40 },
      ],
      width: 6,
    },
  ],
};

describe('getReserveDistance', () => {
  it('measures the distance to a circle edge, negative inside', () => {
    expect(getReserveDistance(RESERVED, 0, 0)).toBeCloseTo(-10, 9);
    expect(getReserveDistance(RESERVED, -15, 0)).toBeCloseTo(5, 9);
  });

  it('measures the distance to the nearest segment of a corridor minus half its width', () => {
    expect(getReserveDistance(RESERVED, 20, 20)).toBeCloseTo(-3, 9);
    expect(getReserveDistance(RESERVED, 30, 20)).toBeCloseTo(7, 9);
    expect(getReserveDistance(RESERVED, 40, 50)).toBeCloseTo(7, 9);
    expect(getReserveDistance(RESERVED, 70, 40)).toBeCloseTo(7, 9);
  });

  it('takes the nearest of all reserved shapes and treats an empty reserve as infinitely far', () => {
    expect(getReserveDistance(RESERVED, 14, 0)).toBeCloseTo(3, 9);
    expect(getReserveDistance(EMPTY_TERRAIN_RESERVED, 0, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});
