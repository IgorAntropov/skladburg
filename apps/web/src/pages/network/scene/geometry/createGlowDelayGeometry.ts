import type { BufferGeometry } from 'three';

import { InstancedBufferAttribute } from 'three';

import { WORLD_GLOW_DELAY_ATTRIBUTE } from '@/shared/3d';

export const attachGlowDelays = (geometry: BufferGeometry, delays: Float32Array): BufferGeometry => {
  geometry.setAttribute(WORLD_GLOW_DELAY_ATTRIBUTE, new InstancedBufferAttribute(delays, 1));

  return geometry;
};

export const createGlowDelayGeometry = (source: BufferGeometry, delays: Float32Array): BufferGeometry =>
  attachGlowDelays(source.clone(), delays);
