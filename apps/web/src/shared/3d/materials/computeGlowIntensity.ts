import { MathUtils } from 'three';

export const WORLD_GLOW_RAMP = 0.12;

export const computeGlowIntensity = (value: number, delay: number, ramp: number = WORLD_GLOW_RAMP): number => {
  return MathUtils.smoothstep(value, delay, delay + ramp);
};
