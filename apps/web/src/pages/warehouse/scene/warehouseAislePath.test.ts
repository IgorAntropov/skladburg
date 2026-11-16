import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  findWarehouseAislePath,
  isWarehouseAislePointOpen,
  isWarehouseAisleSegmentOpen,
} from './warehouseAislePath';

const bounds = { maxX: 10, maxZ: 8, minX: 0, minZ: 0 };
const from = { x: 1.13, z: 4.07 };
const to = { x: 8.89, z: 3.91 };
const clearance = 0.4;

describe('warehouse aisle path', () => {
  it('keeps the exact endpoints of an unobstructed route', () => {
    const rack = { maxX: 6, maxZ: 2, minX: 4, minZ: 1 };

    expect(findWarehouseAislePath(bounds, [rack], from, to, clearance)).toEqual([from, to]);
  });

  it('detours around a rack without clipping its corners', () => {
    const rack = { maxX: 6, maxZ: 6, minX: 4, minZ: 2 };
    const route = findWarehouseAislePath(bounds, [rack], from, to, clearance) ?? [];

    expect(route.at(0)).toEqual(from);
    expect(route.at(-1)).toEqual(to);
    expect(route.length).toBeGreaterThan(2);
    for (const [index, start] of route.slice(0, -1).entries()) {
      const end = route[index + 1];
      if (end === undefined) {
        throw new Error('Expected a route segment');
      }
      expect(isWarehouseAisleSegmentOpen(bounds, [rack], start, end, clearance)).toBe(true);
    }
  });

  it('rejects a passage too narrow for the clearance diameter', () => {
    const racks = [
      { maxX: 6, maxZ: 3.6, minX: 4, minZ: 0 },
      { maxX: 6, maxZ: 8, minX: 4, minZ: 4.3 },
    ];

    expect(findWarehouseAislePath(bounds, racks, from, to, clearance)).toBeUndefined();
  });

  it('accounts for the clearance at the floor boundary', () => {
    const behindWall = { x: 0.2, z: 3 };

    expect(isWarehouseAislePointOpen(bounds, [], behindWall, clearance)).toBe(false);
    expect(findWarehouseAislePath(bounds, [], behindWall, to, clearance)).toBeUndefined();
  });

  it('blocks a line touching the corner of the clearance area', () => {
    const rack = { maxX: 6, maxZ: 6, minX: 4, minZ: 2 };
    const cornerStart = { x: 2.5, z: 2.5 };
    const cornerEnd = { x: 4.5, z: 0.5 };

    expect(isWarehouseAisleSegmentOpen(bounds, [rack], cornerStart, cornerEnd, 0.5)).toBe(false);
  });

  it('does not reject a diagonal for an obstacle outside the line within its bounding box', () => {
    const rack = { maxX: 3, maxZ: 6, minX: 2, minZ: 5 };

    expect(isWarehouseAisleSegmentOpen(bounds, [rack], { x: 1, z: 1 }, { x: 7, z: 7 }, clearance)).toBe(true);
  });

  it('routes round a wide obstruction on a large imported floor', () => {
    const largeFloor = { maxX: 100_000, maxZ: 100_000, minX: -100_000, minZ: -100_000 };
    const distantFrom = { x: -80_000, z: 0 };
    const distantTo = { x: 80_000, z: 0 };
    const obstacles = Array.from({ length: 10_000 }, (_, index) => ({
      maxX: 1_005 + index,
      maxZ: 30_000,
      minX: -12_000 + index,
      minZ: -30_000,
    }));
    const route = findWarehouseAislePath(largeFloor, obstacles, distantFrom, distantTo, clearance) ?? [];

    expect(route.at(0)).toEqual(distantFrom);
    expect(route.at(-1)).toEqual(distantTo);
    expect(route.length).toBeGreaterThan(2);
  });
});
