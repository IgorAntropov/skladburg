import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getTileCenter,
  getTileGrid,
} from './getTileGrid';

describe('getTileGrid', () => {
  it('lays one tile per meter of the bounds', () => {
    const grid = getTileGrid({
      maxX: 12,
      maxZ: 8,
      minX: -12,
      minZ: -8,
    });

    expect(grid.columns).toBe(24);
    expect(grid.rows).toBe(16);
    expect(grid.count).toBe(384);
    expect(grid.pitchX).toBe(1);
    expect(grid.pitchZ).toBe(1);
  });

  it('places tile centers inside the bounds, covering every cell exactly once', () => {
    const bounds = {
      maxX: 4,
      maxZ: 13,
      minX: 1,
      minZ: 10,
    };
    const grid = getTileGrid(bounds);
    const centers = Array.from({ length: grid.count }, (_, index) => getTileCenter(grid, index));
    const uniqueKeys = new Set(centers.map(center => `${String(center.x)}:${String(center.z)}`));

    expect(uniqueKeys.size).toBe(9);
    expect(centers[0]).toEqual({ x: 1.5, z: 10.5 });
    expect(centers[8]).toEqual({ x: 3.5, z: 12.5 });
    centers.forEach((center) => {
      expect(center.x).toBeGreaterThan(bounds.minX);
      expect(center.x).toBeLessThan(bounds.maxX);
      expect(center.z).toBeGreaterThan(bounds.minZ);
      expect(center.z).toBeLessThan(bounds.maxZ);
    });
  });

  it('stretches the pitch so a fractional size still ends on the bounds edge', () => {
    const grid = getTileGrid({
      maxX: 10.4,
      maxZ: 2,
      minX: 0,
      minZ: 0,
    });
    const lastColumnCenter = getTileCenter(grid, grid.columns - 1);

    expect(grid.columns).toBe(10);
    expect(lastColumnCenter.x + grid.pitchX / 2).toBeCloseTo(10.4, 9);
  });

  it('keeps at least one tile for empty bounds', () => {
    const grid = getTileGrid({
      maxX: 0,
      maxZ: 0,
      minX: 0,
      minZ: 0,
    });

    expect(grid.count).toBe(1);
  });
});
