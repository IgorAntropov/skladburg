import type { TerrainContextValue } from './terrainContext';

import {
  TERRAIN_EDGE_CLEAR_METERS,
  TERRAIN_EDGE_RAMP_METERS,
  TERRAIN_RELIEF_AMPLITUDE_METERS,
  TERRAIN_RELIEF_FEATURE_METERS,
  TERRAIN_RESERVE_FLAT_PADDING_METERS,
  TERRAIN_RESERVE_RAMP_METERS,
  TERRAIN_SALT_RELIEF,
  TERRAIN_SLOPE_RAMP_METERS,
  TERRAIN_SURFACE_GROUND_ALT,
  TERRAIN_WATER_LEVEL_METERS,
} from './terrainConstants';
import { smoothstep } from './terrainMath';
import {
  createNoiseField,
  sampleNoiseField,
} from './terrainNoise';

const DIAGONAL_STEP = 1.4142135623730951;
const UNREACHED_DISTANCE = 1e9;

const markFlatVertices = (context: TerrainContextValue, triangleSurface: Uint8Array): Uint8Array => {
  const { grid, triangleVertices } = context;
  const isFlat = new Uint8Array(grid.vertexCount);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if ((triangleSurface[triangle] ?? 0) > TERRAIN_SURFACE_GROUND_ALT) {
      const base = triangle * 3;
      isFlat[triangleVertices[base] ?? 0] = 1;
      isFlat[triangleVertices[base + 1] ?? 0] = 1;
      isFlat[triangleVertices[base + 2] ?? 0] = 1;
    }
  }

  return isFlat;
};

const measureFlatDistance = (context: TerrainContextValue, isFlat: Uint8Array): Float32Array => {
  const { grid } = context;
  const columns = grid.vertexColumns;
  const rows = grid.vertexRows;
  const distance = new Float32Array(grid.vertexCount);

  for (let vertex = 0; vertex < grid.vertexCount; vertex += 1) {
    distance[vertex] = isFlat[vertex] === 1 ? 0 : UNREACHED_DISTANCE;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const vertex = row * columns + column;
      let best = distance[vertex] ?? UNREACHED_DISTANCE;
      let candidate: number;

      if (column > 0) {
        candidate = (distance[vertex - 1] ?? UNREACHED_DISTANCE) + 1;
        best = candidate < best ? candidate : best;
      }

      if (row > 0) {
        candidate = (distance[vertex - columns] ?? UNREACHED_DISTANCE) + 1;
        best = candidate < best ? candidate : best;

        if (column > 0) {
          candidate = (distance[vertex - columns - 1] ?? UNREACHED_DISTANCE) + DIAGONAL_STEP;
          best = candidate < best ? candidate : best;
        }

        if (column < columns - 1) {
          candidate = (distance[vertex - columns + 1] ?? UNREACHED_DISTANCE) + DIAGONAL_STEP;
          best = candidate < best ? candidate : best;
        }
      }

      distance[vertex] = best;
    }
  }

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      const vertex = row * columns + column;
      let best = distance[vertex] ?? UNREACHED_DISTANCE;
      let candidate: number;

      if (column < columns - 1) {
        candidate = (distance[vertex + 1] ?? UNREACHED_DISTANCE) + 1;
        best = candidate < best ? candidate : best;
      }

      if (row < rows - 1) {
        candidate = (distance[vertex + columns] ?? UNREACHED_DISTANCE) + 1;
        best = candidate < best ? candidate : best;

        if (column < columns - 1) {
          candidate = (distance[vertex + columns + 1] ?? UNREACHED_DISTANCE) + DIAGONAL_STEP;
          best = candidate < best ? candidate : best;
        }

        if (column > 0) {
          candidate = (distance[vertex + columns - 1] ?? UNREACHED_DISTANCE) + DIAGONAL_STEP;
          best = candidate < best ? candidate : best;
        }
      }

      distance[vertex] = best;
    }
  }

  return distance;
};

export const buildTerrainHeights = (
  context: TerrainContextValue,
  triangleSurface: Uint8Array,
  vertexWater: Uint8Array,
): Float32Array => {
  const { grid, seed, vertexEdgeDistance, vertexReserveDistance, vertexX, vertexZ } = context;
  const heights = new Float32Array(grid.vertexCount);
  const isFlat = markFlatVertices(context, triangleSurface);
  const flatDistance = measureFlatDistance(context, isFlat);
  const relief = createNoiseField({
    bounds: { maxX: grid.maxX, maxZ: grid.maxZ, minX: grid.minX, minZ: grid.minZ },
    featureMeters: TERRAIN_RELIEF_FEATURE_METERS,
    octaves: 2,
    salt: TERRAIN_SALT_RELIEF,
    seed,
  });
  const cellMeters = grid.cellSizeX < grid.cellSizeZ ? grid.cellSizeX : grid.cellSizeZ;

  for (let vertex = 0; vertex < grid.vertexCount; vertex += 1) {
    if ((vertexWater[vertex] ?? 0) > 0) {
      heights[vertex] = TERRAIN_WATER_LEVEL_METERS;
    }
    else if (isFlat[vertex] === 0) {
      const edgeWeight = smoothstep(
        TERRAIN_EDGE_CLEAR_METERS,
        TERRAIN_EDGE_CLEAR_METERS + TERRAIN_EDGE_RAMP_METERS,
        vertexEdgeDistance[vertex] ?? 0,
      );
      const reserveWeight = smoothstep(
        0,
        TERRAIN_RESERVE_RAMP_METERS,
        (vertexReserveDistance[vertex] ?? 0) - TERRAIN_RESERVE_FLAT_PADDING_METERS,
      );

      if (edgeWeight > 0 && reserveWeight > 0) {
        const slopeWeight = smoothstep(0, TERRAIN_SLOPE_RAMP_METERS, (flatDistance[vertex] ?? 0) * cellMeters);
        heights[vertex] = TERRAIN_RELIEF_AMPLITUDE_METERS
          * sampleNoiseField(relief, vertexX[vertex] ?? 0, vertexZ[vertex] ?? 0) * slopeWeight * reserveWeight * edgeWeight;
      }
    }
  }

  return heights;
};
