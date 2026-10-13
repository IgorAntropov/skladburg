import type { TerrainContextValue } from './terrainContext';
import type { TerrainWarpValue } from './terrainShoreWarp';
import type { TerrainSurfaceGroupValue } from './terrainTypes';

import { TERRAIN_SURFACE_KEYS } from './terrainConstants';

export interface TerrainGroundMeshValue {
  groundGroups: readonly TerrainSurfaceGroupValue[];
  groundPositions: Float32Array;
}

export const buildGroundMesh = (
  context: TerrainContextValue,
  triangleSurface: Uint8Array,
  heights: Float32Array,
  warp: TerrainWarpValue,
): TerrainGroundMeshValue => {
  const { grid, triangleVertices } = context;
  const { meshX, meshZ } = warp;
  const surfaceCount = TERRAIN_SURFACE_KEYS.length;
  const triangleCounts = new Uint32Array(surfaceCount);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    const surface = triangleSurface[triangle] ?? 0;
    triangleCounts[surface] = (triangleCounts[surface] ?? 0) + 1;
  }

  const groundGroups: TerrainSurfaceGroupValue[] = [];
  const cursors = new Uint32Array(surfaceCount);
  let startTriangle = 0;

  for (let surface = 0; surface < surfaceCount; surface += 1) {
    const count = triangleCounts[surface] ?? 0;
    const key = TERRAIN_SURFACE_KEYS[surface];
    cursors[surface] = startTriangle;

    if (count > 0 && key !== undefined) {
      groundGroups.push({ count: count * 3, key, start: startTriangle * 3 });
    }

    startTriangle += count;
  }

  const groundPositions = new Float32Array(grid.triangleCount * 9);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    const surface = triangleSurface[triangle] ?? 0;
    const destination = cursors[surface] ?? 0;
    cursors[surface] = destination + 1;

    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = triangleVertices[triangle * 3 + corner] ?? 0;
      const offset = destination * 9 + corner * 3;
      groundPositions[offset] = meshX[vertex] ?? 0;
      groundPositions[offset + 1] = heights[vertex] ?? 0;
      groundPositions[offset + 2] = meshZ[vertex] ?? 0;
    }
  }

  return { groundGroups, groundPositions };
};
