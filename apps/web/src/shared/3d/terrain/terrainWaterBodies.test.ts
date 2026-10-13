import {
  describe,
  expect,
  it,
} from 'vitest';

import { createSquareWorld } from '../world/sceneWorld';
import {
  TERRAIN_SURFACE_GROUND,
  TERRAIN_SURFACE_SAND,
  TERRAIN_SURFACE_WATER,
} from './terrainConstants';
import { createTerrainContext } from './terrainContext';
import { EMPTY_TERRAIN_RESERVED } from './terrainReserve';
import {
  drainSmallWaterBodies,
  fillSandNotches,
  fillWaterIslands,
  paintLakeSand,
  smoothShoreline,
} from './terrainWaterBodies';

const CELLS_PER_SIDE = 10;

const createContext = (): ReturnType<typeof createTerrainContext> =>
  createTerrainContext({ reserved: EMPTY_TERRAIN_RESERVED, seed: 1, world: createSquareWorld(CELLS_PER_SIDE * 2) });

const fillCells = (surface: Uint8Array, column: number, row: number, width: number, depth: number): void => {
  for (let currentRow = row; currentRow < row + depth; currentRow += 1) {
    for (let currentColumn = column; currentColumn < column + width; currentColumn += 1) {
      const cell = currentRow * CELLS_PER_SIDE + currentColumn;
      surface[cell * 2] = TERRAIN_SURFACE_WATER;
      surface[cell * 2 + 1] = TERRAIN_SURFACE_WATER;
    }
  }
};

const countSurface = (surface: Uint8Array, key: number): number => surface.filter(value => value === key).length;

describe('drainSmallWaterBodies', () => {
  it('turns a body smaller than the minimum back into ground and keeps the larger one', () => {
    const context = createContext();
    const surface = new Uint8Array(context.grid.triangleCount);

    fillCells(surface, 0, 0, 2, 2);
    fillCells(surface, 5, 5, 4, 4);

    const isDrainedVertex = drainSmallWaterBodies(context, surface, 20);

    expect(countSurface(surface, TERRAIN_SURFACE_WATER)).toBe(32);
    expect(surface.slice(0, 2)).toEqual(new Uint8Array([TERRAIN_SURFACE_GROUND, TERRAIN_SURFACE_GROUND]));
    expect(isDrainedVertex[0]).toBe(1);
    expect(isDrainedVertex[CELLS_PER_SIDE + 1 + 1]).toBe(1);
    expect(isDrainedVertex[5 * (CELLS_PER_SIDE + 1) + 5]).toBe(0);
  });

  it('joins bodies that touch only at a corner into one', () => {
    const context = createContext();
    const surface = new Uint8Array(context.grid.triangleCount);

    fillCells(surface, 0, 0, 2, 2);
    fillCells(surface, 2, 2, 2, 2);

    drainSmallWaterBodies(context, surface, 16);

    expect(countSurface(surface, TERRAIN_SURFACE_WATER)).toBe(16);
  });

  it('leaves every body alone when none is under the minimum', () => {
    const context = createContext();
    const surface = new Uint8Array(context.grid.triangleCount);

    fillCells(surface, 1, 1, 3, 3);

    const isDrainedVertex = drainSmallWaterBodies(context, surface, 18);

    expect(countSurface(surface, TERRAIN_SURFACE_WATER)).toBe(18);
    expect(isDrainedVertex.every(value => value === 0)).toBe(true);
  });
});

describe('shoreline smoothing', () => {
  const WIDE_CELLS = 100;
  const BLOCK_START = 48;
  const BLOCK_SIZE = 4;

  const createWideContext = (): ReturnType<typeof createTerrainContext> =>
    createTerrainContext({ reserved: EMPTY_TERRAIN_RESERVED, seed: 1, world: createSquareWorld(WIDE_CELLS * 2) });

  const fillBlock = (surface: Uint8Array, key: number): void => {
    for (let row = BLOCK_START; row < BLOCK_START + BLOCK_SIZE; row += 1) {
      for (let column = BLOCK_START; column < BLOCK_START + BLOCK_SIZE; column += 1) {
        const cell = row * WIDE_CELLS + column;
        surface[cell * 2] = key;
        surface[cell * 2 + 1] = key;
      }
    }
  };

  const getTriangle = (column: number, row: number, index: number): number => (row * WIDE_CELLS + column) * 2 + index;

  it('removes a body of one cell that has no neighbours with water on two sides', () => {
    const context = createWideContext();
    const surface = new Uint8Array(context.grid.triangleCount);
    const peninsula = [getTriangle(BLOCK_START, BLOCK_START, 0), getTriangle(BLOCK_START, BLOCK_START, 1)];

    for (const triangle of peninsula) {
      surface[triangle] = TERRAIN_SURFACE_WATER;
    }

    smoothShoreline(context, surface);

    expect(countSurface(surface, TERRAIN_SURFACE_WATER)).toBe(0);
  });

  it('fills a notch that has water on two or more sides', () => {
    const context = createWideContext();
    const surface = new Uint8Array(context.grid.triangleCount);
    const notch = getTriangle(BLOCK_START + 1, BLOCK_START + 1, 0);

    fillBlock(surface, TERRAIN_SURFACE_WATER);
    surface[notch] = TERRAIN_SURFACE_GROUND;
    smoothShoreline(context, surface);

    expect(surface[notch]).toBe(TERRAIN_SURFACE_WATER);
  });

  it('does not grow water inside the strip along the world edge', () => {
    const context = createContext();
    const surface = new Uint8Array(context.grid.triangleCount);

    const notch = (2 * CELLS_PER_SIDE + 2) * 2;

    fillCells(surface, 1, 1, 3, 3);
    surface[notch] = TERRAIN_SURFACE_GROUND;
    smoothShoreline(context, surface);

    expect(surface[notch]).toBe(TERRAIN_SURFACE_GROUND);
  });

  it('fills a meadow notch between sand and water, but never turns water into sand', () => {
    const context = createWideContext();
    const surface = new Uint8Array(context.grid.triangleCount);
    const notch = getTriangle(BLOCK_START + 1, BLOCK_START + 1, 1);

    fillBlock(surface, TERRAIN_SURFACE_SAND);
    surface[notch] = TERRAIN_SURFACE_GROUND;
    surface[getTriangle(BLOCK_START, BLOCK_START, 0)] = TERRAIN_SURFACE_WATER;
    fillSandNotches(context, surface);

    expect(surface[notch]).toBe(TERRAIN_SURFACE_SAND);
    expect(surface[getTriangle(BLOCK_START, BLOCK_START, 0)]).toBe(TERRAIN_SURFACE_WATER);
  });
});

describe('paintLakeSand', () => {
  const LAKE_CELLS = 120;
  const createLakeContext = (): ReturnType<typeof createTerrainContext> =>
    createTerrainContext({ reserved: EMPTY_TERRAIN_RESERVED, seed: 1, world: createSquareWorld(LAKE_CELLS * 2) });

  const fillSquare = (surface: Uint8Array, start: number, size: number): void => {
    for (let row = start; row < start + size; row += 1) {
      for (let column = start; column < start + size; column += 1) {
        const cell = row * LAKE_CELLS + column;
        surface[cell * 2] = TERRAIN_SURFACE_WATER;
        surface[cell * 2 + 1] = TERRAIN_SURFACE_WATER;
      }
    }
  };

  const measureSandWidth = (surface: Uint8Array, row: number, fromColumn: number): number => {
    let width = 0;

    for (let column = fromColumn; column >= 0; column -= 1) {
      const cell = row * LAKE_CELLS + column;

      if (surface[cell * 2] !== TERRAIN_SURFACE_SAND && surface[cell * 2 + 1] !== TERRAIN_SURFACE_SAND) {
        break;
      }

      width += 1;
    }

    return width;
  };

  it('wraps a small lake in a ring of one cell, narrower than the lake itself', () => {
    const context = createLakeContext();
    const surface = new Uint8Array(context.grid.triangleCount);
    const start = 60;

    fillSquare(surface, start, 6);
    paintLakeSand(context, surface);

    const width = measureSandWidth(surface, start + 3, start - 1);

    expect(width).toBeGreaterThanOrEqual(1);
    expect(width).toBeLessThanOrEqual(2);
    expect(width).toBeLessThan(6);
  });

  it('wraps a large lake in a wider ring than a small one', () => {
    const smallContext = createLakeContext();
    const smallSurface = new Uint8Array(smallContext.grid.triangleCount);
    const largeContext = createLakeContext();
    const largeSurface = new Uint8Array(largeContext.grid.triangleCount);

    fillSquare(smallSurface, 60, 6);
    fillSquare(largeSurface, 30, 60);
    paintLakeSand(smallContext, smallSurface);
    paintLakeSand(largeContext, largeSurface);

    expect(measureSandWidth(largeSurface, 60, 29)).toBeGreaterThan(measureSandWidth(smallSurface, 63, 59));
  });

  it('adds no sand without water and keeps every water triangle', () => {
    const context = createLakeContext();
    const surface = new Uint8Array(context.grid.triangleCount);

    paintLakeSand(context, surface);

    expect(countSurface(surface, TERRAIN_SURFACE_SAND)).toBe(0);

    fillSquare(surface, 50, 8);
    paintLakeSand(context, surface);

    expect(countSurface(surface, TERRAIN_SURFACE_WATER)).toBe(8 * 8 * 2);
  });
});

describe('fillWaterIslands', () => {
  const ISLAND_CELLS = 40;
  const createIslandContext = (): ReturnType<typeof createTerrainContext> =>
    createTerrainContext({ reserved: EMPTY_TERRAIN_RESERVED, seed: 1, world: createSquareWorld(ISLAND_CELLS * 2) });

  it('floods a small patch of land enclosed by water and keeps the mainland', () => {
    const context = createIslandContext();
    const surface = new Uint8Array(context.grid.triangleCount);

    for (let row = 10; row < 30; row += 1) {
      for (let column = 10; column < 30; column += 1) {
        const cell = row * ISLAND_CELLS + column;
        const isIsland = row >= 19 && row < 21 && column >= 19 && column < 21;

        if (!isIsland) {
          surface[cell * 2] = TERRAIN_SURFACE_WATER;
          surface[cell * 2 + 1] = TERRAIN_SURFACE_WATER;
        }
      }
    }

    fillWaterIslands(context, surface, 16);

    expect(countSurface(surface, TERRAIN_SURFACE_WATER)).toBe(20 * 20 * 2);
    expect(surface[0]).toBe(TERRAIN_SURFACE_GROUND);
  });

  it('keeps a larger island', () => {
    const context = createIslandContext();
    const surface = new Uint8Array(context.grid.triangleCount);

    for (let row = 10; row < 30; row += 1) {
      for (let column = 10; column < 30; column += 1) {
        const cell = row * ISLAND_CELLS + column;
        const isIsland = row >= 16 && row < 24 && column >= 16 && column < 24;

        if (!isIsland) {
          surface[cell * 2] = TERRAIN_SURFACE_WATER;
          surface[cell * 2 + 1] = TERRAIN_SURFACE_WATER;
        }
      }
    }

    fillWaterIslands(context, surface, 16);

    expect(countSurface(surface, TERRAIN_SURFACE_WATER)).toBe((20 * 20 - 8 * 8) * 2);
  });
});
