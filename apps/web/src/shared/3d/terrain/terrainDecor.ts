import type { TerrainContextValue } from './terrainContext';
import type { InstanceSeedValue } from './terrainInstances';
import type { TerrainWarpValue } from './terrainShoreWarp';
import type { TerrainDecorValue } from './terrainTypes';

import {
  TERRAIN_CONIFER_GROVE_THRESHOLD,
  TERRAIN_DECOR_EDGE_CLEAR_METERS,
  TERRAIN_DECOR_RESERVE_CLEAR_METERS,
  TERRAIN_DECOR_RESERVE_FADE_METERS,
  TERRAIN_FOREST_FEATURE_METERS,
  TERRAIN_FOREST_ROCK_CHANCE,
  TERRAIN_GROVE_FEATURE_METERS,
  TERRAIN_GROVE_MIX_CHANCE,
  TERRAIN_MAX_ROCKS,
  TERRAIN_MAX_TREES,
  TERRAIN_ROCK_LIFT_RATIO,
  TERRAIN_SALT_FOREST,
  TERRAIN_SALT_GROVE,
  TERRAIN_SALT_SHARE,
  TERRAIN_SALT_SINGLE,
  TERRAIN_SALT_TREE,
  TERRAIN_SECOND_TREE_CHANCE,
  TERRAIN_SHARE_FOREST_MIN,
  TERRAIN_SHARE_FOREST_SPAN,
  TERRAIN_SHORE_ROCK_CHANCE,
  TERRAIN_SINGLE_ROCK_CHANCE,
  TERRAIN_SINGLE_TREE_CHANCE,
  TERRAIN_SURFACE_FIELD,
  TERRAIN_SURFACE_FIELD_ALT,
  TERRAIN_SURFACE_GROUND,
  TERRAIN_SURFACE_GROUND_ALT,
  TERRAIN_SURFACE_SAND,
  TERRAIN_SURFACE_WATER,
  TERRAIN_TREE_JITTER_METERS,
  TERRAIN_TREE_SINK_METERS,
} from './terrainConstants';
import {
  TERRAIN_CONIFER_SCALE,
  TERRAIN_DECIDUOUS_SCALE,
  TERRAIN_ROCK_FLATTENING,
  TERRAIN_ROCK_SCALE,
} from './terrainDecorShapes';
import {
  CELL_FIELD,
  CELL_FREE,
} from './terrainFields';
import { sampleTerrainHeight } from './terrainGrid';
import { hashUnit } from './terrainHash';
import {
  finalizeDecor,
  limitRecordsByRank,
  pushRockRecord,
  pushTreeRecord,
} from './terrainInstances';
import {
  findTopShareThreshold,
  smoothstep,
} from './terrainMath';
import {
  createNoiseField,
  sampleNoiseField,
} from './terrainNoise';
import { locateOnMesh } from './terrainShoreWarp';

const isMeadowSurface = (surface: number): boolean => surface === TERRAIN_SURFACE_GROUND || surface === TERRAIN_SURFACE_GROUND_ALT;

const isRockSurface = (surface: number): boolean => surface !== TERRAIN_SURFACE_WATER
  && surface !== TERRAIN_SURFACE_FIELD
  && surface !== TERRAIN_SURFACE_FIELD_ALT;

const FOREST_EDGE_THINNING = 0.4;
const FOREST_EDGE_SOFTNESS = 0.1;

export interface DecorPlacementValue {
  decor: readonly TerrainDecorValue[];
  forestShare: number;
}

export const placeDecor = (
  context: TerrainContextValue,
  triangleSurface: Uint8Array,
  cellState: Uint8Array,
  heights: Float32Array,
  warp: TerrainWarpValue,
): DecorPlacementValue => {
  const { cellCenterX, cellCenterZ, cellEdgeDistance, cellReserveDistance, grid, seed } = context;
  const cellCount = grid.cellsX * grid.cellsZ;
  const bounds = { maxX: grid.maxX, maxZ: grid.maxZ, minX: grid.minX, minZ: grid.minZ };
  const forestField = createNoiseField({
    bounds,
    featureMeters: TERRAIN_FOREST_FEATURE_METERS,
    octaves: 3,
    salt: TERRAIN_SALT_FOREST,
    seed,
  });
  const groveField = createNoiseField({
    bounds,
    featureMeters: TERRAIN_GROVE_FEATURE_METERS,
    octaves: 2,
    salt: TERRAIN_SALT_GROVE,
    seed,
  });
  const forestValues = new Float32Array(cellCount);
  const siteFlags = new Uint8Array(cellCount);

  for (let cell = 0; cell < cellCount; cell += 1) {
    const hasWater = triangleSurface[cell * 2] === TERRAIN_SURFACE_WATER || triangleSurface[cell * 2 + 1] === TERRAIN_SURFACE_WATER;
    const isSite = !hasWater
      && (cellEdgeDistance[cell] ?? 0) >= TERRAIN_DECOR_EDGE_CLEAR_METERS
      && cellState[cell] !== CELL_FIELD;

    siteFlags[cell] = isSite ? 1 : 0;
    forestValues[cell] = isSite && cellState[cell] === CELL_FREE
      ? sampleNoiseField(forestField, cellCenterX[cell] ?? 0, cellCenterZ[cell] ?? 0)
      : -1;
  }

  const forestShareTarget = TERRAIN_SHARE_FOREST_MIN + hashUnit(seed, 2, 0, TERRAIN_SALT_SHARE) * TERRAIN_SHARE_FOREST_SPAN;
  const forestTarget = forestShareTarget * cellCount;
  const forestThreshold = findTopShareThreshold(forestValues, forestTarget);
  const deciduousRecords: number[] = [];
  const coniferRecords: number[] = [];
  const rockRecords: number[] = [];
  let forestCells = 0;

  const resolveGroundHeight = (
    cell: number,
    x: number,
    z: number,
    isSurfaceAllowed: (surface: number) => boolean,
  ): number | undefined => {
    if (warp.isCellWarped[cell] !== 1) {
      return sampleTerrainHeight(grid, heights, x, z);
    }

    const hit = locateOnMesh(context, warp, triangleSurface, heights, x, z);

    return hit !== undefined && isSurfaceAllowed(hit.surface) ? hit.height : undefined;
  };

  const addTree = (instance: InstanceSeedValue, x: number, z: number): void => {
    const groundY = resolveGroundHeight(instance.cell, x, z, isMeadowSurface);

    if (groundY === undefined) {
      return;
    }

    const grove = sampleNoiseField(groveField, x, z) >= TERRAIN_CONIFER_GROVE_THRESHOLD;
    const isMixed = hashUnit(seed, instance.cell, instance.slot * 16 + 11, TERRAIN_SALT_TREE) < TERRAIN_GROVE_MIX_CHANCE;
    const isConifer = grove !== isMixed;
    if (isConifer) {
      pushTreeRecord(coniferRecords, instance, x, groundY, z, TERRAIN_CONIFER_SCALE, TERRAIN_TREE_SINK_METERS);
    }
    else {
      pushTreeRecord(deciduousRecords, instance, x, groundY, z, TERRAIN_DECIDUOUS_SCALE, TERRAIN_TREE_SINK_METERS);
    }
  };

  const addRock = (instance: InstanceSeedValue, x: number, z: number): void => {
    const groundY = resolveGroundHeight(instance.cell, x, z, isRockSurface);

    if (groundY === undefined) {
      return;
    }

    pushRockRecord(
      rockRecords,
      instance,
      x,
      groundY,
      z,
      TERRAIN_ROCK_SCALE,
      TERRAIN_ROCK_FLATTENING,
      TERRAIN_ROCK_LIFT_RATIO,
    );
  };

  for (let cell = 0; cell < cellCount; cell += 1) {
    const isAllowed = siteFlags[cell] === 1 && (cellReserveDistance[cell] ?? 0) >= TERRAIN_DECOR_RESERVE_CLEAR_METERS;

    if (isAllowed) {
      const centerX = cellCenterX[cell] ?? 0;
      const centerZ = cellCenterZ[cell] ?? 0;
      const forestValue = forestValues[cell] ?? -1;
      const isForest = forestValue >= 0 && forestValue >= forestThreshold;
      const isOpen = cellState[cell] === CELL_FREE && !isForest;
      const hasSand = triangleSurface[cell * 2] === TERRAIN_SURFACE_SAND || triangleSurface[cell * 2 + 1] === TERRAIN_SURFACE_SAND;
      const fade = smoothstep(
        TERRAIN_DECOR_RESERVE_CLEAR_METERS,
        TERRAIN_DECOR_RESERVE_CLEAR_METERS + TERRAIN_DECOR_RESERVE_FADE_METERS,
        cellReserveDistance[cell] ?? 0,
      );
      const roll = (index: number): number => hashUnit(seed, cell, index, TERRAIN_SALT_SINGLE);
      const place = (slot: number): readonly [number, number] => [
        centerX + (hashUnit(seed, cell, slot * 16 + 12, TERRAIN_SALT_TREE) - 0.5) * TERRAIN_TREE_JITTER_METERS,
        centerZ + (hashUnit(seed, cell, slot * 16 + 13, TERRAIN_SALT_TREE) - 0.5) * TERRAIN_TREE_JITTER_METERS,
      ];

      if (isForest) {
        forestCells += 1;
        const edgeFactor = smoothstep(0, FOREST_EDGE_SOFTNESS, forestValue - forestThreshold);
        const keep = (1 - FOREST_EDGE_THINNING + FOREST_EDGE_THINNING * edgeFactor) * fade;
        const slots = hashUnit(seed, cell, 0, TERRAIN_SALT_TREE) < TERRAIN_SECOND_TREE_CHANCE ? 2 : 1;

        for (let slot = 0; slot < slots; slot += 1) {
          if (hashUnit(seed, cell, slot * 16 + 14, TERRAIN_SALT_TREE) < keep) {
            const [x, z] = place(slot);
            addTree({ cell, salt: 1, seed, slot }, x, z);
          }
        }

        if (roll(1) < TERRAIN_FOREST_ROCK_CHANCE * fade) {
          const [x, z] = place(2);
          addRock({ cell, salt: 2, seed, slot: 2 }, x, z);
        }
      }
      else if (isOpen) {
        if (roll(0) < TERRAIN_SINGLE_TREE_CHANCE * fade) {
          const [x, z] = place(3);
          addTree({ cell, salt: 1, seed, slot: 3 }, x, z);
        }

        if (roll(1) < TERRAIN_SINGLE_ROCK_CHANCE * fade) {
          const [x, z] = place(4);
          addRock({ cell, salt: 2, seed, slot: 4 }, x, z);
        }
      }
      else if (hasSand && roll(2) < TERRAIN_SHORE_ROCK_CHANCE * fade) {
        const [x, z] = place(5);
        addRock({ cell, salt: 2, seed, slot: 5 }, x, z);
      }
    }
  }

  const [limitedDeciduous = [], limitedConifer = []] = limitRecordsByRank([deciduousRecords, coniferRecords], TERRAIN_MAX_TREES);
  const [limitedRocks = []] = limitRecordsByRank([rockRecords], TERRAIN_MAX_ROCKS);

  return {
    decor: [
      finalizeDecor('deciduous', limitedDeciduous),
      finalizeDecor('conifer', limitedConifer),
      finalizeDecor('rock', limitedRocks),
    ],
    forestShare: forestCells / cellCount,
  };
};
