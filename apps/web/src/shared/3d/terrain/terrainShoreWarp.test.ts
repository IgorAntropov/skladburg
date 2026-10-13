import {
  describe,
  expect,
  it,
} from 'vitest';

import { createSquareWorld } from '../world/sceneWorld';
import {
  TERRAIN_SURFACE_FIELD,
  TERRAIN_SURFACE_GROUND,
  TERRAIN_SURFACE_SAND,
  TERRAIN_SURFACE_WATER,
} from './terrainConstants';
import { createTerrainContext } from './terrainContext';
import { EMPTY_TERRAIN_RESERVED } from './terrainReserve';
import {
  locateOnMesh,
  warpShoreVertices,
} from './terrainShoreWarp';

const CELLS = 60;

const createContext = (seed = 1): ReturnType<typeof createTerrainContext> =>
  createTerrainContext({ reserved: EMPTY_TERRAIN_RESERVED, seed, world: createSquareWorld(CELLS * 2) });

const setCells = (surface: Uint8Array, key: number, column: number, row: number, width: number, depth: number): void => {
  for (let currentRow = row; currentRow < row + depth; currentRow += 1) {
    for (let currentColumn = column; currentColumn < column + width; currentColumn += 1) {
      const cell = currentRow * CELLS + currentColumn;
      surface[cell * 2] = key;
      surface[cell * 2 + 1] = key;
    }
  }
};

const createShoreSurface = (context: ReturnType<typeof createTerrainContext>): Uint8Array => {
  const surface = new Uint8Array(context.grid.triangleCount);

  setCells(surface, TERRAIN_SURFACE_SAND, 18, 18, 24, 24);
  setCells(surface, TERRAIN_SURFACE_WATER, 20, 20, 20, 20);

  return surface;
};

const getDoubleArea = (
  warp: ReturnType<typeof warpShoreVertices>,
  context: ReturnType<typeof createTerrainContext>,
  triangle: number,
): number => {
  const [a = 0, b = 0, c = 0] = [0, 1, 2].map(corner => context.triangleVertices[triangle * 3 + corner] ?? 0);
  const ax = warp.meshX[a] ?? 0;
  const az = warp.meshZ[a] ?? 0;

  return ((warp.meshZ[b] ?? 0) - az) * ((warp.meshX[c] ?? 0) - ax) - ((warp.meshX[b] ?? 0) - ax) * ((warp.meshZ[c] ?? 0) - az);
};

describe('warpShoreVertices', () => {
  it('moves the vertices of the shore and nothing else', () => {
    const context = createContext();
    const warp = warpShoreVertices(context, createShoreSurface(context));
    let movedFar = 0;
    let movedNear = 0;

    for (let vertex = 0; vertex < context.grid.vertexCount; vertex += 1) {
      const isMoved = warp.meshX[vertex] !== context.vertexX[vertex] || warp.meshZ[vertex] !== context.vertexZ[vertex];
      const column = vertex % context.grid.vertexColumns;
      const row = (vertex - column) / context.grid.vertexColumns;
      const isNearShore = column >= 18 && column <= 42 && row >= 18 && row <= 42;

      if (isMoved && isNearShore) {
        movedNear += 1;
      }

      if (isMoved && !isNearShore) {
        movedFar += 1;
      }
    }

    expect(movedNear).toBeGreaterThan(30);
    expect(movedFar).toBe(0);
  });

  it('keeps every triangle facing up with a solid share of its area', () => {
    const context = createContext();
    const warp = warpShoreVertices(context, createShoreSurface(context));
    const cellArea = context.grid.cellSizeX * context.grid.cellSizeZ;

    for (let triangle = 0; triangle < context.grid.triangleCount; triangle += 1) {
      expect(getDoubleArea(warp, context, triangle)).toBeGreaterThan(cellArea * 0.1);
    }
  });

  it('keeps a vertex that touches a field where it is', () => {
    const context = createContext();
    const surface = createShoreSurface(context);

    setCells(surface, TERRAIN_SURFACE_FIELD, 14, 18, 4, 24);

    const warp = warpShoreVertices(context, surface);
    const sharedVertex = 18 * context.grid.vertexColumns + 18;

    expect(warp.meshX[sharedVertex]).toBe(context.vertexX[sharedVertex]);
    expect(warp.meshZ[sharedVertex]).toBe(context.vertexZ[sharedVertex]);
  });

  it('gives the same result for the same seed and another one for another seed', () => {
    const first = createContext(1);
    const second = createContext(2);
    const warpA = warpShoreVertices(first, createShoreSurface(first));
    const warpB = warpShoreVertices(first, createShoreSurface(first));
    const warpC = warpShoreVertices(second, createShoreSurface(second));

    expect(warpB.meshX).toEqual(warpA.meshX);
    expect(warpB.meshZ).toEqual(warpA.meshZ);
    expect(warpC.meshX).not.toEqual(warpA.meshX);
  });

  it('flags the cells that touch a moved vertex', () => {
    const context = createContext();
    const warp = warpShoreVertices(context, createShoreSurface(context));

    expect(warp.isCellWarped[30 * CELLS + 30]).toBe(0);
    expect(warp.isCellWarped[19 * CELLS + 25]).toBe(1);
    expect(warp.isCellWarped[5 * CELLS + 5]).toBe(0);
  });
});

describe('locateOnMesh', () => {
  it('finds the triangle on the warped mesh that holds the point and interpolates the height on it', () => {
    const context = createContext();
    const surface = createShoreSurface(context);
    const warp = warpShoreVertices(context, surface);
    const heights = Float32Array.from({ length: context.grid.vertexCount }, (_, vertex) => (vertex % 7) * 0.1);
    let located = 0;

    for (let triangle = 0; triangle < context.grid.triangleCount; triangle += 1) {
      const [a = 0, b = 0, c = 0] = [0, 1, 2].map(corner => context.triangleVertices[triangle * 3 + corner] ?? 0);
      const x = ((warp.meshX[a] ?? 0) + (warp.meshX[b] ?? 0) + (warp.meshX[c] ?? 0)) / 3;
      const z = ((warp.meshZ[a] ?? 0) + (warp.meshZ[b] ?? 0) + (warp.meshZ[c] ?? 0)) / 3;
      const hit = locateOnMesh(context, warp, surface, heights, x, z);

      expect(hit?.surface).toBe(surface[triangle]);
      expect(hit?.height).toBeCloseTo(((heights[a] ?? 0) + (heights[b] ?? 0) + (heights[c] ?? 0)) / 3, 5);
      located += 1;
    }

    expect(located).toBe(context.grid.triangleCount);
  });

  it('gives nothing for a point outside the world', () => {
    const context = createContext();
    const surface = new Uint8Array(context.grid.triangleCount).fill(TERRAIN_SURFACE_GROUND);
    const warp = warpShoreVertices(context, surface);

    expect(locateOnMesh(context, warp, surface, new Float32Array(context.grid.vertexCount), 1000, 1000)).toBeUndefined();
  });
});
