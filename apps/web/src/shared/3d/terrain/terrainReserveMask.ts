import type { TerrainContextValue } from './terrainContext';

import {
  TERRAIN_FIELD_RESERVE_CLEAR_METERS,
  TERRAIN_SURFACE_FIELD,
  TERRAIN_SURFACE_FIELD_ALT,
  TERRAIN_SURFACE_GROUND,
  TERRAIN_SURFACE_SAND,
  TERRAIN_SURFACE_WATER,
  TERRAIN_WATER_RESERVE_CLEAR_METERS,
} from './terrainConstants';

export const clearReservedSurfaces = (context: TerrainContextValue, triangleSurface: Uint8Array): void => {
  const { cellReserveDistance, grid } = context;
  const cellCount = grid.cellsX * grid.cellsZ;

  for (let cell = 0; cell < cellCount; cell += 1) {
    const distance = cellReserveDistance[cell] ?? Number.POSITIVE_INFINITY;

    if (distance < TERRAIN_WATER_RESERVE_CLEAR_METERS) {
      for (let triangle = cell * 2; triangle < cell * 2 + 2; triangle += 1) {
        const surface = triangleSurface[triangle];
        const isWet = surface === TERRAIN_SURFACE_WATER || surface === TERRAIN_SURFACE_SAND;
        const isField = surface === TERRAIN_SURFACE_FIELD || surface === TERRAIN_SURFACE_FIELD_ALT;

        if (isWet || (isField && distance < TERRAIN_FIELD_RESERVE_CLEAR_METERS)) {
          triangleSurface[triangle] = TERRAIN_SURFACE_GROUND;
        }
      }
    }
  }
};
