import {
  describe,
  expect,
  it,
} from 'vitest';

import type { MapSideValue } from '@/entities/network';

import type {
  SiteBannerAtlasLayoutValue,
  SiteBannerCellPixelsValue,
} from './siteBannerAtlasLayout';

import { NETWORK_SIDES } from '../geometry/networkSides';
import {
  computeSiteBannerAtlasLayout,
  readFarCellPixels,
  readNearCellPixels,
  readSharedNearCellPixels,
  SITE_BANNER_ATLAS_CAPACITY,
  SITE_BANNER_ATLAS_MAX_HEIGHT_PX,
  SITE_BANNER_ATLAS_WIDTH_PX,
  toCellUv,
} from './siteBannerAtlasLayout';

const listAllCells = (layout: SiteBannerAtlasLayoutValue, count: number): SiteBannerCellPixelsValue[] => [
  ...NETWORK_SIDES.map(side => readFarCellPixels(side)),
  ...NETWORK_SIDES.map(side => readSharedNearCellPixels(layout, side)),
  ...Array.from({ length: count }, (_, index) => readNearCellPixels(layout, index)),
];

const isOverlapping = (current: SiteBannerCellPixelsValue, prev: SiteBannerCellPixelsValue): boolean => (
  current.x < prev.x + prev.width
  && prev.x < current.x + current.width
  && current.y < prev.y + prev.height
  && prev.y < current.y + current.height
);

const isPowerOfTwo = (value: number): boolean => Number.isInteger(Math.log2(value));

describe('capacity', () => {
  it('holds 53 organizations beside the three shared cells of the sides', () => {
    expect(SITE_BANNER_ATLAS_CAPACITY).toBe(53);
  });
});

describe('computeSiteBannerAtlasLayout', () => {
  it('is 2048 wide and takes a power of two for the height', () => {
    for (const count of [0, 1, 5, 9, 20, 29, 30, 53]) {
      const layout = computeSiteBannerAtlasLayout(count);

      expect(layout.width).toBe(SITE_BANNER_ATLAS_WIDTH_PX);
      expect(isPowerOfTwo(layout.height)).toBe(true);
      expect(layout.height).toBeLessThanOrEqual(SITE_BANNER_ATLAS_MAX_HEIGHT_PX);
    }
  });

  it('makes the atlas of 9 organizations 2048 by 512 and the full one 2048 by 1024', () => {
    expect(computeSiteBannerAtlasLayout(9)).toMatchObject({ height: 512, width: 2048 });
    expect(computeSiteBannerAtlasLayout(53)).toMatchObject({ height: 1024, width: 2048 });
    expect(computeSiteBannerAtlasLayout(1).height).toBe(256);
  });

  it('cuts the organizations over the capacity', () => {
    expect(computeSiteBannerAtlasLayout(54).capacity).toBe(53);
    expect(computeSiteBannerAtlasLayout(1000)).toMatchObject({ capacity: 53, height: 1024 });
    expect(computeSiteBannerAtlasLayout(9).capacity).toBe(9);
    expect(computeSiteBannerAtlasLayout(-4).capacity).toBe(0);
  });

  it('does not let the height grow with the count between powers of two', () => {
    const heights = Array.from({ length: 54 }, (_, count) => computeSiteBannerAtlasLayout(count).height);

    expect(heights).toEqual(heights.toSorted((current, prev) => current - prev));
  });
});

describe('cells', () => {
  it.each([0, 1, 9, 29, 53])('lie inside the canvas and never overlap for %s organizations', (count) => {
    const layout = computeSiteBannerAtlasLayout(count);
    const cells = listAllCells(layout, layout.capacity);

    expect(cells).toHaveLength(NETWORK_SIDES.length * 2 + layout.capacity);

    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.width).toBeLessThanOrEqual(layout.width);
      expect(cell.y + cell.height).toBeLessThanOrEqual(layout.height);
    }

    for (const [index, cell] of cells.entries()) {
      for (const prev of cells.slice(0, index)) {
        expect(isOverlapping(cell, prev)).toBe(false);
      }
    }
  });

  it('gives each side its own flag cell of 64 by 64 in the first row', () => {
    const cells = NETWORK_SIDES.map(side => readFarCellPixels(side));

    expect(new Set(cells.map(cell => cell.x)).size).toBe(3);

    for (const cell of cells) {
      expect(cell).toMatchObject({ height: 64, width: 64, y: 0 });
    }
  });

  it('gives each organization its own banner cell of 256 by 128 below the flags', () => {
    const layout = computeSiteBannerAtlasLayout(9);
    const cells = Array.from({ length: 9 }, (_, index) => readNearCellPixels(layout, index));

    expect(new Set(cells.map(cell => `${String(cell.x)}:${String(cell.y)}`)).size).toBe(9);

    for (const cell of cells) {
      expect(cell).toMatchObject({ height: 128, width: 256 });
      expect(cell.y).toBeGreaterThanOrEqual(64);
    }
  });

  it('keeps the shared cell of a side apart for every side', () => {
    const layout = computeSiteBannerAtlasLayout(9);
    const sides: readonly MapSideValue[] = ['customer', 'supplier', 'carrier'];
    const keys = sides.map((side) => {
      const cell = readSharedNearCellPixels(layout, side);

      return `${String(cell.x)}:${String(cell.y)}`;
    });

    expect(new Set(keys).size).toBe(3);
  });
});

describe('toCellUv', () => {
  it('insets the cell by half a texel on every edge and flips the vertical axis', () => {
    const layout = computeSiteBannerAtlasLayout(9);
    const cell = { height: 128, width: 256, x: 256, y: 64 };
    const uv = toCellUv(layout, cell);

    expect(uv.u0).toBeCloseTo(256.5 / layout.width, 10);
    expect(uv.u1).toBeCloseTo(511.5 / layout.width, 10);
    expect(uv.v1).toBeCloseTo(1 - 64.5 / layout.height, 10);
    expect(uv.v0).toBeCloseTo(1 - 191.5 / layout.height, 10);
    expect(uv.u0).toBeLessThan(uv.u1);
    expect(uv.v0).toBeLessThan(uv.v1);
  });

  it('keeps every cell inside the unit square', () => {
    const layout = computeSiteBannerAtlasLayout(53);

    for (const cell of listAllCells(layout, 53)) {
      const uv = toCellUv(layout, cell);

      expect(uv.u0).toBeGreaterThan(0);
      expect(uv.u1).toBeLessThan(1);
      expect(uv.v0).toBeGreaterThan(0);
      expect(uv.v1).toBeLessThan(1);
    }
  });
});
