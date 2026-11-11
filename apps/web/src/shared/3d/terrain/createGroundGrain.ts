import type { Box3 } from 'three';

import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
} from 'three';

import { hashUnit } from './terrainHash';
import { lerp } from './terrainMath';

const GRAIN_SIZE = 64;
const GRAIN_REPEAT_METERS = 9;
const GRAIN_SEED = 41;

const sampleGrain = (x: number, z: number, frequency: number): number => {
  const gridX = x * frequency / GRAIN_SIZE;
  const gridZ = z * frequency / GRAIN_SIZE;
  const left = Math.floor(gridX);
  const top = Math.floor(gridZ);
  const right = (left + 1) % frequency;
  const bottom = (top + 1) % frequency;
  const fractionX = gridX - left;
  const fractionZ = gridZ - top;
  const blendX = fractionX * fractionX * (3 - 2 * fractionX);
  const blendZ = fractionZ * fractionZ * (3 - 2 * fractionZ);
  const first = lerp(hashUnit(GRAIN_SEED, left, top, frequency), hashUnit(GRAIN_SEED, right, top, frequency), blendX);
  const second = lerp(hashUnit(GRAIN_SEED, left, bottom, frequency), hashUnit(GRAIN_SEED, right, bottom, frequency), blendX);

  return lerp(first, second, blendZ);
};

export const createGroundGrain = (bounds: Box3 | null): DataTexture => {
  const rgba = new Uint8Array(GRAIN_SIZE * GRAIN_SIZE * 4);

  for (let texel = 0; texel < GRAIN_SIZE * GRAIN_SIZE; texel += 1) {
    const x = texel % GRAIN_SIZE;
    const z = Math.floor(texel / GRAIN_SIZE);
    const tone = 235 + 7 * sampleGrain(x, z, 8) + 7 * sampleGrain(x, z, 19) + 5 * hashUnit(GRAIN_SEED, x, z, 31);
    const offset = texel * 4;

    rgba[offset] = tone;
    rgba[offset + 1] = tone;
    rgba[offset + 2] = tone;
    rgba[offset + 3] = 255;
  }

  const texture = new DataTexture(rgba, GRAIN_SIZE, GRAIN_SIZE);
  texture.generateMipmaps = true;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;

  if (bounds !== null) {
    texture.repeat.set((bounds.max.x - bounds.min.x) / GRAIN_REPEAT_METERS, (bounds.max.z - bounds.min.z) / GRAIN_REPEAT_METERS);
    texture.offset.set(bounds.min.x / GRAIN_REPEAT_METERS, bounds.min.z / GRAIN_REPEAT_METERS);
  }

  return texture;
};
