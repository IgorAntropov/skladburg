import type { TerrainGridValue } from './terrainGrid';
import type {
  TerrainReservedValue,
  WorldTerrainParamsValue,
} from './terrainTypes';

import {
  createTerrainGrid,
  getEdgeDistance,
} from './terrainGrid';
import { getReserveDistance } from './terrainReserve';

export interface TerrainContextValue {
  cellCenterX: Float32Array;
  cellCenterZ: Float32Array;
  cellEdgeDistance: Float32Array;
  cellReserveDistance: Float32Array;
  grid: TerrainGridValue;
  reserved: TerrainReservedValue;
  seed: number;
  triangleVertices: Uint32Array;
  vertexEdgeDistance: Float32Array;
  vertexReserveDistance: Float32Array;
  vertexX: Float32Array;
  vertexZ: Float32Array;
}

export const createTerrainContext = (params: WorldTerrainParamsValue): TerrainContextValue => {
  const grid = createTerrainGrid(params.world.bounds);
  const { cellSizeX, cellSizeZ, cellsX, cellsZ, minX, minZ, vertexColumns, vertexRows } = grid;
  const hasReserve = params.reserved.areas.length > 0 || params.reserved.corridors.length > 0;
  const cellCount = cellsX * cellsZ;
  const vertexX = new Float32Array(grid.vertexCount);
  const vertexZ = new Float32Array(grid.vertexCount);
  const vertexEdgeDistance = new Float32Array(grid.vertexCount);
  const vertexReserveDistance = new Float32Array(grid.vertexCount);
  const cellCenterX = new Float32Array(cellCount);
  const cellCenterZ = new Float32Array(cellCount);
  const cellEdgeDistance = new Float32Array(cellCount);
  const cellReserveDistance = new Float32Array(cellCount);
  const triangleVertices = new Uint32Array(grid.triangleCount * 3);

  if (!hasReserve) {
    vertexReserveDistance.fill(Number.POSITIVE_INFINITY);
    cellReserveDistance.fill(Number.POSITIVE_INFINITY);
  }

  for (let row = 0; row < vertexRows; row += 1) {
    const z = minZ + row * cellSizeZ;

    for (let column = 0; column < vertexColumns; column += 1) {
      const x = minX + column * cellSizeX;
      const vertex = row * vertexColumns + column;
      vertexX[vertex] = x;
      vertexZ[vertex] = z;
      vertexEdgeDistance[vertex] = getEdgeDistance(grid, x, z);

      if (hasReserve) {
        vertexReserveDistance[vertex] = getReserveDistance(params.reserved, x, z);
      }
    }
  }

  for (let row = 0; row < cellsZ; row += 1) {
    const z = minZ + (row + 0.5) * cellSizeZ;

    for (let column = 0; column < cellsX; column += 1) {
      const x = minX + (column + 0.5) * cellSizeX;
      const cell = row * cellsX + column;
      const a = row * vertexColumns + column;
      const b = a + 1;
      const c = a + vertexColumns;
      const d = c + 1;
      const target = cell * 6;
      cellCenterX[cell] = x;
      cellCenterZ[cell] = z;
      cellEdgeDistance[cell] = getEdgeDistance(grid, x, z);

      if (hasReserve) {
        cellReserveDistance[cell] = getReserveDistance(params.reserved, x, z);
      }

      triangleVertices[target] = a;
      triangleVertices[target + 1] = c;

      if (((column + row) & 1) === 0) {
        triangleVertices[target + 2] = d;
        triangleVertices[target + 3] = a;
        triangleVertices[target + 4] = d;
        triangleVertices[target + 5] = b;
      }
      else {
        triangleVertices[target + 2] = b;
        triangleVertices[target + 3] = b;
        triangleVertices[target + 4] = c;
        triangleVertices[target + 5] = d;
      }
    }
  }

  return {
    cellCenterX,
    cellCenterZ,
    cellEdgeDistance,
    cellReserveDistance,
    grid,
    reserved: params.reserved,
    seed: params.seed | 0,
    triangleVertices,
    vertexEdgeDistance,
    vertexReserveDistance,
    vertexX,
    vertexZ,
  };
};
