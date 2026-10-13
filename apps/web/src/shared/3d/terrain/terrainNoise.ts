import type { SceneBoundsValue } from '../world/sceneBounds';

import { hashUnit } from './terrainHash';
import { readNumber } from './terrainMath';

export interface TerrainNoiseFieldValue {
  inverseWeightSum: number;
  layers: readonly NoiseLayerValue[];
}

export interface TerrainNoiseOptionsValue {
  bounds: SceneBoundsValue;
  featureMeters: number;
  octaves: number;
  salt: number;
  seed: number;
}

interface NoiseLayerValue {
  columns: number;
  cos: number;
  frequency: number;
  lattice: Float32Array;
  originU: number;
  originV: number;
  rows: number;
  sin: number;
  weight: number;
}

const OCTAVE_ROTATIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.8, 0.6],
  [0.6, -0.8],
  [0, 1],
];

const OFFSET_RANGE = 64;
const LATTICE_PADDING = 1;

const createLayer = (options: TerrainNoiseOptionsValue, octave: number): NoiseLayerValue => {
  const { bounds, featureMeters, salt, seed } = options;
  const rotation = OCTAVE_ROTATIONS[octave % OCTAVE_ROTATIONS.length] ?? [1, 0];
  const cos = rotation[0];
  const sin = rotation[1];
  const frequency = (1 << octave) / featureMeters;
  const layerSalt = salt * 16 + octave;
  const offsetU = hashUnit(seed, octave, 1, layerSalt) * OFFSET_RANGE;
  const offsetV = hashUnit(seed, octave, 2, layerSalt) * OFFSET_RANGE;
  const cornersX = [bounds.minX, bounds.maxX, bounds.minX, bounds.maxX];
  const cornersZ = [bounds.minZ, bounds.minZ, bounds.maxZ, bounds.maxZ];
  let minU = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;

  for (let corner = 0; corner < 4; corner += 1) {
    const x = readNumber(cornersX, corner);
    const z = readNumber(cornersZ, corner);
    const u = (x * cos - z * sin) * frequency + offsetU;
    const v = (x * sin + z * cos) * frequency + offsetV;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }

  const originU = Math.floor(minU) - LATTICE_PADDING;
  const originV = Math.floor(minV) - LATTICE_PADDING;
  const columns = Math.floor(maxU) - originU + LATTICE_PADDING + 2;
  const rows = Math.floor(maxV) - originV + LATTICE_PADDING + 2;
  const lattice = new Float32Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      lattice[row * columns + column] = hashUnit(seed, originU + column, originV + row, layerSalt);
    }
  }

  return {
    columns,
    cos,
    frequency,
    lattice,
    originU: originU - offsetU,
    originV: originV - offsetV,
    rows,
    sin,
    weight: 1 / (1 << octave),
  };
};

export const createNoiseField = (options: TerrainNoiseOptionsValue): TerrainNoiseFieldValue => {
  const layers: NoiseLayerValue[] = [];
  let weightSum = 0;

  for (let octave = 0; octave < options.octaves; octave += 1) {
    const layer = createLayer(options, octave);
    layers.push(layer);
    weightSum += layer.weight;
  }

  return { inverseWeightSum: 1 / weightSum, layers };
};

export const sampleNoiseField = (field: TerrainNoiseFieldValue, x: number, z: number): number => {
  const layers = field.layers;
  const layerCount = layers.length;
  let total = 0;

  for (let index = 0; index < layerCount; index += 1) {
    const layer = layers[index];

    if (layer !== undefined) {
      const u = (x * layer.cos - z * layer.sin) * layer.frequency - layer.originU;
      const v = (x * layer.sin + z * layer.cos) * layer.frequency - layer.originV;
      const column = u | 0;
      const row = v | 0;
      const fractionU = u - column;
      const fractionV = v - row;
      const tu = fractionU * fractionU * fractionU * (fractionU * (fractionU * 6 - 15) + 10);
      const tv = fractionV * fractionV * fractionV * (fractionV * (fractionV * 6 - 15) + 10);
      const base = row * layer.columns + column;
      const lattice = layer.lattice;
      const top = (lattice[base] ?? 0) * (1 - tu) + (lattice[base + 1] ?? 0) * tu;
      const bottom = (lattice[base + layer.columns] ?? 0) * (1 - tu) + (lattice[base + layer.columns + 1] ?? 0) * tu;
      total += (top * (1 - tv) + bottom * tv) * layer.weight;
    }
  }

  return total * field.inverseWeightSum;
};
