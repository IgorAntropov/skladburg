import type { TerrainScaleRangeValue } from './terrainDecorShapes';
import type {
  TerrainDecorKindValue,
  TerrainDecorValue,
} from './terrainTypes';

import {
  TERRAIN_RANK_SCALE,
  TERRAIN_SALT_INSTANCE,
  TERRAIN_TINT_CHANNEL_SPREAD,
  TERRAIN_TINT_MAX,
  TERRAIN_TINT_MIN,
  TERRAIN_TINT_SPREAD,
} from './terrainConstants';
import { TERRAIN_TREE_PROPORTION_SPREAD } from './terrainDecorShapes';
import { hashUnit } from './terrainHash';
import {
  lerp,
  readNumber,
} from './terrainMath';

export const INSTANCE_RECORD_SIZE = 12;

const MIN_DIRECTION_LENGTH = 1e-3;

export interface InstanceSeedValue {
  cell: number;
  salt: number;
  seed: number;
  slot: number;
}

const draw = (instance: InstanceSeedValue, index: number): number =>
  hashUnit(instance.seed, instance.cell, instance.slot * 16 + index, instance.salt * 32 + TERRAIN_SALT_INSTANCE);

const clampTint = (value: number): number => Math.min(TERRAIN_TINT_MAX, Math.max(TERRAIN_TINT_MIN, value));

const pushRecord = (
  records: number[],
  instance: InstanceSeedValue,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
): void => {
  const directionX = draw(instance, 1) * 2 - 1;
  const directionZ = draw(instance, 2) * 2 - 1;
  const length = Math.sqrt(directionX * directionX + directionZ * directionZ);
  const isDirectionUsable = length > MIN_DIRECTION_LENGTH;
  const tone = 1 + (draw(instance, 5) - 0.5) * TERRAIN_TINT_SPREAD;

  records.push(
    draw(instance, 0) * TERRAIN_RANK_SCALE,
    position[0],
    position[1],
    position[2],
    scale[0],
    scale[1],
    scale[2],
    isDirectionUsable ? directionX / length : 1,
    isDirectionUsable ? directionZ / length : 0,
    clampTint(tone * (1 + (draw(instance, 6) - 0.5) * TERRAIN_TINT_CHANNEL_SPREAD)),
    clampTint(tone * (1 + (draw(instance, 7) - 0.5) * TERRAIN_TINT_CHANNEL_SPREAD)),
    clampTint(tone * (1 + (draw(instance, 8) - 0.5) * TERRAIN_TINT_CHANNEL_SPREAD)),
  );
};

export const pushTreeRecord = (
  records: number[],
  instance: InstanceSeedValue,
  x: number,
  groundY: number,
  z: number,
  range: TerrainScaleRangeValue,
  sinkMeters: number,
): void => {
  const size = lerp(range.min, range.max, draw(instance, 3));
  const widthSpread = 1 + (draw(instance, 4) - 0.5) * TERRAIN_TREE_PROPORTION_SPREAD;
  const heightSpread = 1 + (draw(instance, 9) - 0.5) * TERRAIN_TREE_PROPORTION_SPREAD;

  pushRecord(records, instance, [x, groundY - sinkMeters, z], [size * widthSpread, size * heightSpread, size * widthSpread]);
};

export const pushRockRecord = (
  records: number[],
  instance: InstanceSeedValue,
  x: number,
  groundY: number,
  z: number,
  range: TerrainScaleRangeValue,
  flattening: TerrainScaleRangeValue,
  liftRatio: number,
): void => {
  const size = lerp(range.min, range.max, draw(instance, 3));
  const widthSpread = 1 + (draw(instance, 4) - 0.5) * TERRAIN_TREE_PROPORTION_SPREAD;
  const depthSpread = 1 + (draw(instance, 9) - 0.5) * TERRAIN_TREE_PROPORTION_SPREAD;
  const height = size * lerp(flattening.min, flattening.max, draw(instance, 10));

  pushRecord(records, instance, [x, groundY + liftRatio * height, z], [size * widthSpread, height, size * depthSpread]);
};

export const limitRecordsByRank = (recordLists: readonly (readonly number[])[], maxCount: number): number[][] => {
  const ranks: number[] = [];

  for (const records of recordLists) {
    for (let offset = 0; offset < records.length; offset += INSTANCE_RECORD_SIZE) {
      ranks.push(readNumber(records, offset));
    }
  }

  if (ranks.length <= maxCount) {
    return recordLists.map(records => [...records]);
  }

  ranks.sort((current, prev) => current - prev);

  const excludedFromRank = readNumber(ranks, maxCount);

  return recordLists.map((records) => {
    const kept: number[] = [];

    for (let offset = 0; offset < records.length; offset += INSTANCE_RECORD_SIZE) {
      if (readNumber(records, offset) < excludedFromRank) {
        for (let index = 0; index < INSTANCE_RECORD_SIZE; index += 1) {
          kept.push(readNumber(records, offset + index));
        }
      }
    }

    return kept;
  });
};

export const finalizeDecor = (kind: TerrainDecorKindValue, records: readonly number[]): TerrainDecorValue => {
  const count = records.length / INSTANCE_RECORD_SIZE;
  const order = Uint32Array.from({ length: count }, (_, index) => index);
  const readRank = (instance: number): number => readNumber(records, instance * INSTANCE_RECORD_SIZE);

  order.sort((current, prev) => readRank(current) - readRank(prev) || current - prev);

  const matrices = new Float32Array(count * 16);
  const ranks = new Float32Array(count);
  const tints = new Float32Array(count * 3);

  for (let position = 0; position < count; position += 1) {
    const source = readNumber(order, position) * INSTANCE_RECORD_SIZE;
    const cos = readNumber(records, source + 7);
    const sin = readNumber(records, source + 8);
    const scaleX = readNumber(records, source + 4);
    const scaleY = readNumber(records, source + 5);
    const scaleZ = readNumber(records, source + 6);
    const target = position * 16;

    ranks[position] = readNumber(records, source);
    matrices[target] = cos * scaleX;
    matrices[target + 2] = -sin * scaleX;
    matrices[target + 5] = scaleY;
    matrices[target + 8] = sin * scaleZ;
    matrices[target + 10] = cos * scaleZ;
    matrices[target + 12] = readNumber(records, source + 1);
    matrices[target + 13] = readNumber(records, source + 2);
    matrices[target + 14] = readNumber(records, source + 3);
    matrices[target + 15] = 1;
    tints[position * 3] = readNumber(records, source + 9);
    tints[position * 3 + 1] = readNumber(records, source + 10);
    tints[position * 3 + 2] = readNumber(records, source + 11);
  }

  return { kind, matrices, ranks, tints };
};

export const getDecorCountForDensity = (ranks: Float32Array, density: number): number => {
  let low = 0;
  let high = ranks.length;

  while (low < high) {
    const middle = (low + high) >>> 1;

    if (readNumber(ranks, middle) < density) {
      low = middle + 1;
    }
    else {
      high = middle;
    }
  }

  return low;
};
