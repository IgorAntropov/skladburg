import type { TerrainContextValue } from './terrainContext';

import {
  TERRAIN_SALT_SHORE_WARP,
  TERRAIN_SHORE_WARP_CELL_RATIO,
  TERRAIN_SHORE_WARP_EDGE_CLEAR_METERS,
  TERRAIN_SHORE_WARP_MAX_ROUNDS,
  TERRAIN_SHORE_WARP_MIN_AREA_RATIO,
  TERRAIN_SURFACE_FIELD,
  TERRAIN_SURFACE_FIELD_ALT,
  TERRAIN_SURFACE_SAND,
  TERRAIN_SURFACE_WATER,
} from './terrainConstants';
import { hashUnit } from './terrainHash';
import { readNumber } from './terrainMath';

export interface TerrainMeshHitValue {
  height: number;
  surface: number;
}

export interface TerrainWarpValue {
  isCellWarped: Uint8Array;
  meshX: Float32Array;
  meshZ: Float32Array;
}

const BARYCENTRIC_TOLERANCE = 1e-6;

const getDoubleArea = (
  meshX: Float32Array,
  meshZ: Float32Array,
  vertexA: number,
  vertexB: number,
  vertexC: number,
): number => {
  const ax = readNumber(meshX, vertexA);
  const az = readNumber(meshZ, vertexA);

  return (readNumber(meshZ, vertexB) - az) * (readNumber(meshX, vertexC) - ax)
    - (readNumber(meshX, vertexB) - ax) * (readNumber(meshZ, vertexC) - az);
};

const WET_SURFACES_MASK = (1 << TERRAIN_SURFACE_WATER) | (1 << TERRAIN_SURFACE_SAND);
const FIELD_SURFACES_MASK = (1 << TERRAIN_SURFACE_FIELD) | (1 << TERRAIN_SURFACE_FIELD_ALT);

const markShoreVertices = (context: TerrainContextValue, triangleSurface: Uint8Array): Uint8Array => {
  const { grid, triangleVertices, vertexEdgeDistance } = context;
  const touchedSurfaces = new Uint8Array(grid.vertexCount);
  const isShore = new Uint8Array(grid.vertexCount);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    const surfaceBit = 1 << readNumber(triangleSurface, triangle);
    const base = triangle * 3;

    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = readNumber(triangleVertices, base + corner);
      touchedSurfaces[vertex] = readNumber(touchedSurfaces, vertex) | surfaceBit;
    }
  }

  for (let vertex = 0; vertex < grid.vertexCount; vertex += 1) {
    const mask = readNumber(touchedSurfaces, vertex);
    const isBoundary = (mask & (mask - 1)) !== 0;
    const isWet = (mask & WET_SURFACES_MASK) !== 0;
    const isFieldSide = (mask & FIELD_SURFACES_MASK) !== 0;
    const isFarFromEdge = (vertexEdgeDistance[vertex] ?? 0) >= TERRAIN_SHORE_WARP_EDGE_CLEAR_METERS;

    isShore[vertex] = isBoundary && isWet && !isFieldSide && isFarFromEdge ? 1 : 0;
  }

  return isShore;
};

const countCollapsedTriangles = (
  context: TerrainContextValue,
  offsetX: Float32Array,
  offsetZ: Float32Array,
  scale: Float32Array,
  round: number,
): number => {
  const { grid, triangleVertices, vertexX, vertexZ } = context;
  const meshX = new Float32Array(grid.vertexCount);
  const meshZ = new Float32Array(grid.vertexCount);
  const minDoubleArea = grid.cellSizeX * grid.cellSizeZ * TERRAIN_SHORE_WARP_MIN_AREA_RATIO;
  const isLastRound = round >= TERRAIN_SHORE_WARP_MAX_ROUNDS - 1;
  let collapsed = 0;

  for (let vertex = 0; vertex < grid.vertexCount; vertex += 1) {
    meshX[vertex] = readNumber(vertexX, vertex) + readNumber(offsetX, vertex) * readNumber(scale, vertex);
    meshZ[vertex] = readNumber(vertexZ, vertex) + readNumber(offsetZ, vertex) * readNumber(scale, vertex);
  }

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    const base = triangle * 3;
    const a = readNumber(triangleVertices, base);
    const b = readNumber(triangleVertices, base + 1);
    const c = readNumber(triangleVertices, base + 2);

    if (getDoubleArea(meshX, meshZ, a, b, c) < minDoubleArea) {
      collapsed += 1;

      for (const vertex of [a, b, c]) {
        scale[vertex] = isLastRound ? 0 : readNumber(scale, vertex) * 0.5;
      }
    }
  }

  return collapsed;
};

export const warpShoreVertices = (context: TerrainContextValue, triangleSurface: Uint8Array): TerrainWarpValue => {
  const { grid, seed, vertexX, vertexZ } = context;
  const isShore = markShoreVertices(context, triangleSurface);
  const amplitude = Math.min(grid.cellSizeX, grid.cellSizeZ) * TERRAIN_SHORE_WARP_CELL_RATIO;
  const offsetX = new Float32Array(grid.vertexCount);
  const offsetZ = new Float32Array(grid.vertexCount);
  const scale = new Float32Array(grid.vertexCount).fill(1);

  for (let vertex = 0; vertex < grid.vertexCount; vertex += 1) {
    if (isShore[vertex] === 1) {
      offsetX[vertex] = (hashUnit(seed, vertex, 1, TERRAIN_SALT_SHORE_WARP) * 2 - 1) * amplitude;
      offsetZ[vertex] = (hashUnit(seed, vertex, 2, TERRAIN_SALT_SHORE_WARP) * 2 - 1) * amplitude;
    }
  }

  let round = 0;

  while (countCollapsedTriangles(context, offsetX, offsetZ, scale, round) > 0) {
    round += 1;
  }

  const meshX = new Float32Array(grid.vertexCount);
  const meshZ = new Float32Array(grid.vertexCount);
  const isVertexWarped = new Uint8Array(grid.vertexCount);

  for (let vertex = 0; vertex < grid.vertexCount; vertex += 1) {
    const factor = readNumber(scale, vertex);
    meshX[vertex] = readNumber(vertexX, vertex) + readNumber(offsetX, vertex) * factor;
    meshZ[vertex] = readNumber(vertexZ, vertex) + readNumber(offsetZ, vertex) * factor;
    isVertexWarped[vertex] = isShore[vertex] === 1 && factor > 0 ? 1 : 0;
  }

  const isCellWarped = new Uint8Array(grid.cellsX * grid.cellsZ);

  for (let row = 0; row < grid.cellsZ; row += 1) {
    for (let column = 0; column < grid.cellsX; column += 1) {
      const base = row * grid.vertexColumns + column;
      const isWarped = isVertexWarped[base] === 1
        || isVertexWarped[base + 1] === 1
        || isVertexWarped[base + grid.vertexColumns] === 1
        || isVertexWarped[base + grid.vertexColumns + 1] === 1;

      isCellWarped[row * grid.cellsX + column] = isWarped ? 1 : 0;
    }
  }

  return { isCellWarped, meshX, meshZ };
};

export const locateOnMesh = (
  context: TerrainContextValue,
  warp: TerrainWarpValue,
  triangleSurface: Uint8Array,
  heights: Float32Array,
  x: number,
  z: number,
): TerrainMeshHitValue | undefined => {
  const { grid, triangleVertices } = context;
  const { meshX, meshZ } = warp;
  const centerColumn = Math.floor((x - grid.minX) / grid.cellSizeX);
  const centerRow = Math.floor((z - grid.minZ) / grid.cellSizeZ);

  for (let row = Math.max(0, centerRow - 1); row <= Math.min(grid.cellsZ - 1, centerRow + 1); row += 1) {
    for (let column = Math.max(0, centerColumn - 1); column <= Math.min(grid.cellsX - 1, centerColumn + 1); column += 1) {
      for (let half = 0; half < 2; half += 1) {
        const triangle = (row * grid.cellsX + column) * 2 + half;
        const base = triangle * 3;
        const a = readNumber(triangleVertices, base);
        const b = readNumber(triangleVertices, base + 1);
        const c = readNumber(triangleVertices, base + 2);
        const determinant = -getDoubleArea(meshX, meshZ, a, b, c);
        const weightB = ((x - readNumber(meshX, a)) * (readNumber(meshZ, c) - readNumber(meshZ, a))
          - (readNumber(meshX, c) - readNumber(meshX, a)) * (z - readNumber(meshZ, a))) / determinant;
        const weightC = ((readNumber(meshX, b) - readNumber(meshX, a)) * (z - readNumber(meshZ, a))
          - (x - readNumber(meshX, a)) * (readNumber(meshZ, b) - readNumber(meshZ, a))) / determinant;
        const weightA = 1 - weightB - weightC;

        if (weightA >= -BARYCENTRIC_TOLERANCE && weightB >= -BARYCENTRIC_TOLERANCE && weightC >= -BARYCENTRIC_TOLERANCE) {
          return {
            height: weightA * readNumber(heights, a) + weightB * readNumber(heights, b) + weightC * readNumber(heights, c),
            surface: readNumber(triangleSurface, triangle),
          };
        }
      }
    }
  }

  return undefined;
};

