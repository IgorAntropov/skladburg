import type { TerrainContextValue } from './terrainContext';

import {
  TERRAIN_FARMLAND_FEATURE_METERS,
  TERRAIN_FARMLAND_RELAX,
  TERRAIN_FARMLAND_START,
  TERRAIN_FIELD_ALT_CHANCE,
  TERRAIN_FIELD_EDGE_CLEAR_METERS,
  TERRAIN_FIELD_MAX_ATTEMPTS,
  TERRAIN_FIELD_MIN_CELLS,
  TERRAIN_FIELD_SIZE_VARIANTS,
  TERRAIN_GROUND_ALT_THRESHOLD,
  TERRAIN_SALT_FARMLAND,
  TERRAIN_SALT_FIELD_RECT,
  TERRAIN_SALT_FIELD_TONE,
  TERRAIN_SALT_GROUND_TONE,
  TERRAIN_SALT_SHARE,
  TERRAIN_SHARE_FIELD_MIN,
  TERRAIN_SHARE_FIELD_SPAN,
  TERRAIN_SURFACE_FIELD,
  TERRAIN_SURFACE_FIELD_ALT,
  TERRAIN_SURFACE_GROUND,
  TERRAIN_SURFACE_GROUND_ALT,
  TERRAIN_TONE_FEATURE_METERS,
} from './terrainConstants';
import {
  hashCoordinates,
  hashUnit,
} from './terrainHash';
import { readNumber } from './terrainMath';
import {
  createNoiseField,
  sampleNoiseField,
} from './terrainNoise';

export const CELL_FREE = 0;
export const CELL_BLOCKED = 1;
export const CELL_FIELD = 2;

export const placeFields = (context: TerrainContextValue, triangleSurface: Uint8Array): Uint8Array => {
  const { cellEdgeDistance, grid, seed } = context;
  const cellCount = grid.cellsX * grid.cellsZ;
  const cellState = new Uint8Array(cellCount);

  for (let cell = 0; cell < cellCount; cell += 1) {
    const isCovered = triangleSurface[cell * 2] !== TERRAIN_SURFACE_GROUND
      || triangleSurface[cell * 2 + 1] !== TERRAIN_SURFACE_GROUND;
    const isTooClose = (cellEdgeDistance[cell] ?? 0) < TERRAIN_FIELD_EDGE_CLEAR_METERS;

    if (isCovered || isTooClose) {
      cellState[cell] = CELL_BLOCKED;
    }
  }

  const farmland = createNoiseField({
    bounds: { maxX: grid.maxX, maxZ: grid.maxZ, minX: grid.minX, minZ: grid.minZ },
    featureMeters: TERRAIN_FARMLAND_FEATURE_METERS,
    octaves: 2,
    salt: TERRAIN_SALT_FARMLAND,
    seed,
  });
  const targetCells = Math.round(
    (TERRAIN_SHARE_FIELD_MIN + hashUnit(seed, 1, 0, TERRAIN_SALT_SHARE) * TERRAIN_SHARE_FIELD_SPAN) * cellCount,
  );
  let fieldCells = 0;

  for (let attempt = 0; attempt < TERRAIN_FIELD_MAX_ATTEMPTS && fieldCells < targetCells; attempt += 1) {
    const sizeBits = hashCoordinates(seed, attempt, 0, TERRAIN_SALT_FIELD_RECT);
    const placeBits = hashCoordinates(seed, attempt, 1, TERRAIN_SALT_FIELD_RECT);
    const width = Math.min(grid.cellsX, TERRAIN_FIELD_MIN_CELLS + (sizeBits & 0xff) % TERRAIN_FIELD_SIZE_VARIANTS);
    const depth = Math.min(grid.cellsZ, TERRAIN_FIELD_MIN_CELLS + (sizeBits >>> 8 & 0xff) % TERRAIN_FIELD_SIZE_VARIANTS);
    const originColumn = (placeBits & 0xffff) % (grid.cellsX - width + 1);
    const originRow = (placeBits >>> 16) % (grid.cellsZ - depth + 1);
    const centerX = grid.minX + (originColumn + width / 2) * grid.cellSizeX;
    const centerZ = grid.minZ + (originRow + depth / 2) * grid.cellSizeZ;
    const requiredFarmland = TERRAIN_FARMLAND_START - TERRAIN_FARMLAND_RELAX * (attempt / TERRAIN_FIELD_MAX_ATTEMPTS);

    if (sampleNoiseField(farmland, centerX, centerZ) >= requiredFarmland) {
      let isFree = true;

      for (let row = originRow; row < originRow + depth && isFree; row += 1) {
        for (let column = originColumn; column < originColumn + width; column += 1) {
          if (readNumber(cellState, row * grid.cellsX + column) !== CELL_FREE) {
            isFree = false;
            break;
          }
        }
      }

      if (isFree) {
        const isAltTone = hashUnit(seed, attempt, 2, TERRAIN_SALT_FIELD_TONE) < TERRAIN_FIELD_ALT_CHANCE;
        const surface = isAltTone ? TERRAIN_SURFACE_FIELD_ALT : TERRAIN_SURFACE_FIELD;

        for (let row = originRow; row < originRow + depth; row += 1) {
          for (let column = originColumn; column < originColumn + width; column += 1) {
            const cell = row * grid.cellsX + column;
            cellState[cell] = CELL_FIELD;
            triangleSurface[cell * 2] = surface;
            triangleSurface[cell * 2 + 1] = surface;
          }
        }

        fieldCells += width * depth;
      }
    }
  }

  return cellState;
};

export const paintGroundTones = (context: TerrainContextValue, triangleSurface: Uint8Array): void => {
  const { cellCenterX, cellCenterZ, grid, seed } = context;
  const tone = createNoiseField({
    bounds: { maxX: grid.maxX, maxZ: grid.maxZ, minX: grid.minX, minZ: grid.minZ },
    featureMeters: TERRAIN_TONE_FEATURE_METERS,
    octaves: 2,
    salt: TERRAIN_SALT_GROUND_TONE,
    seed,
  });
  const cellCount = grid.cellsX * grid.cellsZ;

  for (let cell = 0; cell < cellCount; cell += 1) {
    if (sampleNoiseField(tone, cellCenterX[cell] ?? 0, cellCenterZ[cell] ?? 0) >= TERRAIN_GROUND_ALT_THRESHOLD) {
      if (triangleSurface[cell * 2] === TERRAIN_SURFACE_GROUND) {
        triangleSurface[cell * 2] = TERRAIN_SURFACE_GROUND_ALT;
      }

      if (triangleSurface[cell * 2 + 1] === TERRAIN_SURFACE_GROUND) {
        triangleSurface[cell * 2 + 1] = TERRAIN_SURFACE_GROUND_ALT;
      }
    }
  }
};
