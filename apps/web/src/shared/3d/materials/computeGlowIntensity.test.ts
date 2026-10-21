import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  computeGlowIntensity,
  WORLD_GLOW_RAMP,
} from './computeGlowIntensity';

const DELAY = 0.5;
const SAMPLE_COUNT = 101;

const sampleValues = (): number[] => {
  return Array.from({ length: SAMPLE_COUNT }, (_, index) => index / (SAMPLE_COUNT - 1));
};

describe('computeGlowIntensity', () => {
  it('is zero at and below the delay', () => {
    expect(computeGlowIntensity(0, DELAY)).toBe(0);
    expect(computeGlowIntensity(DELAY - 0.2, DELAY)).toBe(0);
    expect(computeGlowIntensity(DELAY, DELAY)).toBe(0);
  });

  it('is one at and above the delay plus the ramp', () => {
    expect(computeGlowIntensity(DELAY + WORLD_GLOW_RAMP, DELAY)).toBe(1);
    expect(computeGlowIntensity(1, DELAY)).toBe(1);
  });

  it('is one half in the middle of the ramp', () => {
    expect(computeGlowIntensity(DELAY + WORLD_GLOW_RAMP / 2, DELAY)).toBeCloseTo(0.5, 10);
  });

  it('follows the smoothstep curve inside the ramp', () => {
    const progress = 0.25;
    const expected = progress * progress * (3 - 2 * progress);

    expect(computeGlowIntensity(DELAY + WORLD_GLOW_RAMP * progress, DELAY)).toBeCloseTo(expected, 10);
  });

  it('never decreases while the value grows', () => {
    const intensities = sampleValues().map(value => computeGlowIntensity(value, DELAY));

    intensities.forEach((intensity, index) => {
      expect(intensity).toBeGreaterThanOrEqual(intensities[index - 1] ?? 0);
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1);
    });
  });

  it('gives the same values on the way back', () => {
    const values = sampleValues();
    const forward = values.map(value => computeGlowIntensity(value, DELAY));
    const backward = [...values].reverse().map(value => computeGlowIntensity(value, DELAY)).reverse();

    expect(backward).toEqual(forward);
  });

  it('honors an explicit ramp', () => {
    expect(computeGlowIntensity(0.6, 0.5, 0.2)).toBeCloseTo(0.5, 10);
    expect(computeGlowIntensity(0.7, 0.5, 0.2)).toBe(1);
  });
});
