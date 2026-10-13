import type { SceneBoundsValue } from '../world/sceneBounds';

import { TERRAIN_CELL_METERS } from './terrainConstants';
import { readNumber } from './terrainMath';

export interface TerrainGridValue {
  cellSizeX: number;
  cellSizeZ: number;
  cellsX: number;
  cellsZ: number;
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
  triangleCount: number;
  vertexColumns: number;
  vertexCount: number;
  vertexRows: number;
}

export const createTerrainGrid = (bounds: SceneBoundsValue): TerrainGridValue => {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cellsX = Math.max(1, Math.round(width / TERRAIN_CELL_METERS));
  const cellsZ = Math.max(1, Math.round(depth / TERRAIN_CELL_METERS));

  return {
    cellSizeX: width / cellsX,
    cellSizeZ: depth / cellsZ,
    cellsX,
    cellsZ,
    maxX: bounds.maxX,
    maxZ: bounds.maxZ,
    minX: bounds.minX,
    minZ: bounds.minZ,
    triangleCount: cellsX * cellsZ * 2,
    vertexColumns: cellsX + 1,
    vertexCount: (cellsX + 1) * (cellsZ + 1),
    vertexRows: cellsZ + 1,
  };
};

export const getCellParity = (column: number, row: number): number => (column + row) & 1;

export const getVertexIndex = (grid: TerrainGridValue, column: number, row: number): number => row * grid.vertexColumns + column;

export const getEdgeDistance = (grid: TerrainGridValue, x: number, z: number): number => {
  const distanceX = x - grid.minX < grid.maxX - x ? x - grid.minX : grid.maxX - x;
  const distanceZ = z - grid.minZ < grid.maxZ - z ? z - grid.minZ : grid.maxZ - z;

  return distanceX < distanceZ ? distanceX : distanceZ;
};

export const sampleTerrainHeight = (grid: TerrainGridValue, heights: Float32Array, x: number, z: number): number => {
  const gridX = Math.min(grid.cellsX - 1e-6, Math.max(0, (x - grid.minX) / grid.cellSizeX));
  const gridZ = Math.min(grid.cellsZ - 1e-6, Math.max(0, (z - grid.minZ) / grid.cellSizeZ));
  const column = Math.floor(gridX);
  const row = Math.floor(gridZ);
  const fractionX = gridX - column;
  const fractionZ = gridZ - row;
  const base = getVertexIndex(grid, column, row);
  const heightA = readNumber(heights, base);
  const heightB = readNumber(heights, base + 1);
  const heightC = readNumber(heights, base + grid.vertexColumns);
  const heightD = readNumber(heights, base + grid.vertexColumns + 1);

  if (getCellParity(column, row) === 0) {
    return fractionZ >= fractionX
      ? heightA + (heightD - heightC) * fractionX + (heightC - heightA) * fractionZ
      : heightA + (heightB - heightA) * fractionX + (heightD - heightB) * fractionZ;
  }

  return fractionX + fractionZ <= 1
    ? heightA + (heightB - heightA) * fractionX + (heightC - heightA) * fractionZ
    : heightD + (heightC - heightD) * (1 - fractionX) + (heightB - heightD) * (1 - fractionZ);
};
