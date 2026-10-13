import type { TerrainContextValue } from './terrainContext';

import {
  TERRAIN_LAKE_FEATURE_METERS,
  TERRAIN_MAX_ISLAND_TRIANGLES,
  TERRAIN_MIN_LAKE_CELLS,
  TERRAIN_SALT_LAKE,
  TERRAIN_SALT_SHARE,
  TERRAIN_SALT_SHORE,
  TERRAIN_SHARE_WATER_MIN,
  TERRAIN_SHARE_WATER_SPAN,
  TERRAIN_SHORE_WIGGLE_AMPLITUDE,
  TERRAIN_SHORE_WIGGLE_FEATURE_METERS,
  TERRAIN_SURFACE_GROUND,
  TERRAIN_SURFACE_SAND,
  TERRAIN_SURFACE_WATER,
  TERRAIN_WATER_EDGE_CLEAR_METERS,
  TERRAIN_WATER_EDGE_FADE_METERS,
  TERRAIN_WATER_EDGE_PENALTY,
} from './terrainConstants';
import { hashUnit } from './terrainHash';
import {
  findTopShareThreshold,
  smoothstep,
} from './terrainMath';
import {
  createNoiseField,
  sampleNoiseField,
} from './terrainNoise';
import {
  drainSmallWaterBodies,
  fillSandNotches,
  fillWaterIslands,
  paintLakeSand,
  smoothShoreline,
} from './terrainWaterBodies';

export const countWaterVertices = (context: TerrainContextValue, triangleSurface: Uint8Array): Uint8Array => {
  const { grid, triangleVertices } = context;
  const counts = new Uint8Array(grid.vertexCount);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] === TERRAIN_SURFACE_WATER) {
      const base = triangle * 3;
      const a = triangleVertices[base] ?? 0;
      const b = triangleVertices[base + 1] ?? 0;
      const c = triangleVertices[base + 2] ?? 0;
      counts[a] = (counts[a] ?? 0) + 1;
      counts[b] = (counts[b] ?? 0) + 1;
      counts[c] = (counts[c] ?? 0) + 1;
    }
  }

  return counts;
};

export const classifyWater = (context: TerrainContextValue, triangleSurface: Uint8Array): Uint8Array => {
  const { cellEdgeDistance, grid, seed, triangleVertices, vertexX, vertexZ } = context;
  const lakeField = createNoiseField({
    bounds: { maxX: grid.maxX, maxZ: grid.maxZ, minX: grid.minX, minZ: grid.minZ },
    featureMeters: TERRAIN_LAKE_FEATURE_METERS,
    octaves: 3,
    salt: TERRAIN_SALT_LAKE,
    seed,
  });
  const shoreField = createNoiseField({
    bounds: { maxX: grid.maxX, maxZ: grid.maxZ, minX: grid.minX, minZ: grid.minZ },
    featureMeters: TERRAIN_SHORE_WIGGLE_FEATURE_METERS,
    octaves: 2,
    salt: TERRAIN_SALT_SHORE,
    seed,
  });
  const vertexLake = new Float32Array(grid.vertexCount);

  for (let vertex = 0; vertex < grid.vertexCount; vertex += 1) {
    const x = vertexX[vertex] ?? 0;
    const z = vertexZ[vertex] ?? 0;
    vertexLake[vertex] = sampleNoiseField(lakeField, x, z)
      + (sampleNoiseField(shoreField, x, z) - 0.5) * TERRAIN_SHORE_WIGGLE_AMPLITUDE;
  }

  const lakeValues = new Float32Array(grid.triangleCount);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    const cell = triangle >> 1;

    if ((cellEdgeDistance[cell] ?? 0) >= TERRAIN_WATER_EDGE_CLEAR_METERS) {
      const base = triangle * 3;
      const edgeFade = 1 - smoothstep(
        TERRAIN_WATER_EDGE_CLEAR_METERS,
        TERRAIN_WATER_EDGE_CLEAR_METERS + TERRAIN_WATER_EDGE_FADE_METERS,
        cellEdgeDistance[cell] ?? 0,
      );
      lakeValues[triangle] = Math.max(0, Math.min(
        vertexLake[triangleVertices[base] ?? 0] ?? 0,
        vertexLake[triangleVertices[base + 1] ?? 0] ?? 0,
        vertexLake[triangleVertices[base + 2] ?? 0] ?? 0,
      ) - edgeFade * TERRAIN_WATER_EDGE_PENALTY);
    }
    else {
      lakeValues[triangle] = -1;
    }
  }

  const waterTarget = (TERRAIN_SHARE_WATER_MIN + hashUnit(seed, 0, 0, TERRAIN_SALT_SHARE) * TERRAIN_SHARE_WATER_SPAN)
    * grid.triangleCount;
  const waterThreshold = findTopShareThreshold(lakeValues, waterTarget);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    const value = lakeValues[triangle] ?? -1;

    if (value >= 0 && value >= waterThreshold) {
      triangleSurface[triangle] = TERRAIN_SURFACE_WATER;
    }
  }

  smoothShoreline(context, triangleSurface);
  fillWaterIslands(context, triangleSurface, TERRAIN_MAX_ISLAND_TRIANGLES);
  drainSmallWaterBodies(context, triangleSurface, TERRAIN_MIN_LAKE_CELLS * 2);
  paintLakeSand(context, triangleSurface);

  const vertexWater = countWaterVertices(context, triangleSurface);

  fillSandNotches(context, triangleSurface);

  return vertexWater;
};

export const paintShoreSand = (context: TerrainContextValue, triangleSurface: Uint8Array): Uint8Array => {
  const { grid, triangleVertices } = context;
  const vertexWater = countWaterVertices(context, triangleSurface);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] === TERRAIN_SURFACE_GROUND) {
      const base = triangle * 3;
      const isTouchingWater = (vertexWater[triangleVertices[base] ?? 0] ?? 0) > 0
        || (vertexWater[triangleVertices[base + 1] ?? 0] ?? 0) > 0
        || (vertexWater[triangleVertices[base + 2] ?? 0] ?? 0) > 0;

      if (isTouchingWater) {
        triangleSurface[triangle] = TERRAIN_SURFACE_SAND;
      }
    }
  }

  return vertexWater;
};
