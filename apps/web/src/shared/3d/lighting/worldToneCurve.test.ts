import {
  describe,
  expect,
  it,
} from 'vitest';

import type { LinearRgbValue } from './worldToneCurve';

import {
  applyWorldToneCurve,
  buildWorldToneCurveGlsl,
  WORLD_TONE_CURVE,
  WORLD_TONE_FUNCTION_NAME,
} from './worldToneCurve';

const GRID_STEPS = [0, 0.02, 0.08, 0.15, 0.3, 0.5, 0.75];
const EXPOSURES = [0.5, 0.85, 1, 1.2];
const NIGHT_COLORS: LinearRgbValue[] = [
  [0.02, 0.08, 0.15],
  [0.01, 0.03, 0.09],
  [0.004, 0.02, 0.06],
];

const buildGrid = (): LinearRgbValue[] => {
  const colors: LinearRgbValue[] = [];

  for (const red of GRID_STEPS) {
    for (const green of GRID_STEPS) {
      for (const blue of GRID_STEPS) {
        colors.push([red, green, blue]);
      }
    }
  }

  return colors;
};

const pseudoRandom = (seed: number): (() => number) => {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
};

const expectColorsClose = (actual: LinearRgbValue, expected: LinearRgbValue, digits: number): void => {
  expect(actual[0]).toBeCloseTo(expected[0], digits);
  expect(actual[1]).toBeCloseTo(expected[1], digits);
  expect(actual[2]).toBeCloseTo(expected[2], digits);
};

describe('applyWorldToneCurve', () => {
  it('keeps colors below the compression start unchanged after exposure', () => {
    for (const exposure of EXPOSURES) {
      for (const color of [...buildGrid(), ...NIGHT_COLORS]) {
        const exposed = color.map(channel => channel * exposure);

        if (Math.max(...exposed) >= WORLD_TONE_CURVE.compressionStart) {
          continue;
        }

        const result = applyWorldToneCurve(color, exposure);

        expect(result[0]).toBeCloseTo(exposed[0] ?? 0, 12);
        expect(result[1]).toBeCloseTo(exposed[1] ?? 0, 12);
        expect(result[2]).toBeCloseTo(exposed[2] ?? 0, 12);
      }
    }
  });

  it('keeps the weak red of a dark night color', () => {
    const result = applyWorldToneCurve([0.02, 0.08, 0.15], 1);

    expect(result).toEqual([0.02, 0.08, 0.15]);
  });

  it('is continuous at the compression start', () => {
    const start = WORLD_TONE_CURVE.compressionStart;
    const below = applyWorldToneCurve([start - 1e-9, start * 0.5, start * 0.25], 1);
    const at = applyWorldToneCurve([start, start * 0.5, start * 0.25], 1);
    const above = applyWorldToneCurve([start + 1e-9, start * 0.5, start * 0.25], 1);

    expectColorsClose(at, below, 6);
    expectColorsClose(above, at, 6);
  });

  it('never decreases any channel when the whole color brightens', () => {
    const random = pseudoRandom(7);

    for (let index = 0; index < 4000; index += 1) {
      const base: LinearRgbValue = [random() * 4, random() * 4, random() * 4];
      const factor = 1 + random();
      const before = applyWorldToneCurve(base, 1);
      const after = applyWorldToneCurve([base[0] * factor, base[1] * factor, base[2] * factor], 1);

      expect(after[0]).toBeGreaterThanOrEqual(before[0] - 1e-12);
      expect(after[1]).toBeGreaterThanOrEqual(before[1] - 1e-12);
      expect(after[2]).toBeGreaterThanOrEqual(before[2] - 1e-12);
    }
  });

  it('never decreases any channel when a channel below the peak grows', () => {
    const random = pseudoRandom(13);

    for (let index = 0; index < 4000; index += 1) {
      const peak = random() * 4;
      const base: LinearRgbValue = [peak, random() * peak, random() * peak];
      const grown: LinearRgbValue = [peak, base[1] + random() * (peak - base[1]), base[2]];
      const before = applyWorldToneCurve(base, 1);
      const after = applyWorldToneCurve(grown, 1);

      expect(after[0]).toBeGreaterThanOrEqual(before[0] - 1e-12);
      expect(after[1]).toBeGreaterThanOrEqual(before[1] - 1e-12);
      expect(after[2]).toBeGreaterThanOrEqual(before[2] - 1e-12);
    }
  });

  it('never decreases the output peak when any channel grows', () => {
    const random = pseudoRandom(17);

    for (let index = 0; index < 4000; index += 1) {
      const base: [number, number, number] = [random() * 4, random() * 4, random() * 4];
      const grown: [number, number, number] = [base[0], base[1], base[2]];
      const channel = index % 3;

      grown[channel] = (base[channel] ?? 0) + random() * 0.3;

      const before = applyWorldToneCurve(base, 1);
      const after = applyWorldToneCurve(grown, 1);

      expect(Math.max(...after)).toBeGreaterThanOrEqual(Math.max(...before) - 1e-12);
    }
  });

  it('keeps the peak monotonic along a ramp of a grey color', () => {
    let previous = 0;

    for (let step = 0; step <= 2000; step += 1) {
      const level = step * 0.005;
      const result = applyWorldToneCurve([level, level, level], 1);

      expect(result[0]).toBeGreaterThanOrEqual(previous - 1e-12);

      previous = result[0];
    }
  });

  it('stays within zero and one for any non-negative input', () => {
    const random = pseudoRandom(11);

    for (let index = 0; index < 4000; index += 1) {
      const scale = 10 ** (random() * 6 - 2);
      const result = applyWorldToneCurve([random() * scale, random() * scale, random() * scale], 0.5 + random());

      for (const channel of result) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('returns black for black and approaches white for huge values', () => {
    expect(applyWorldToneCurve([0, 0, 0], 1.3)).toEqual([0, 0, 0]);

    const bright = applyWorldToneCurve([1e6, 1e6, 1e6], 1);

    expect(bright[0]).toBeGreaterThan(0.999);
    expect(bright[0]).toBeLessThanOrEqual(1);
  });

  it('desaturates bright saturated colors', () => {
    const result = applyWorldToneCurve([4, 1, 0.2], 1);
    const spreadBefore = 4 - 0.2;
    const spreadAfter = Math.max(...result) - Math.min(...result);

    expect(spreadAfter).toBeLessThan(spreadBefore);
    expect(result[0]).toBeGreaterThan(result[1]);
  });

  it('applies exposure before the curve', () => {
    const doubled = applyWorldToneCurve([0.2, 0.1, 0.05], 2);

    expect(doubled[0]).toBeCloseTo(0.4, 12);
    expect(doubled[1]).toBeCloseTo(0.2, 12);
    expect(doubled[2]).toBeCloseTo(0.1, 12);
  });
});

describe('buildWorldToneCurveGlsl', () => {
  it('uses the same numbers as the constants', () => {
    const glsl = buildWorldToneCurveGlsl();

    expect(glsl).toContain(`const float StartCompression = ${String(WORLD_TONE_CURVE.compressionStart)};`);
    expect(glsl).toContain(`const float Desaturation = ${String(WORLD_TONE_CURVE.desaturation)};`);
    expect(glsl).toContain('color *= toneMappingExposure;');
    expect(glsl).toContain(`vec3 ${WORLD_TONE_FUNCTION_NAME}( vec3 color )`);
  });

  it('has no comments and no shadow toe', () => {
    const glsl = buildWorldToneCurveGlsl();

    expect(glsl).not.toContain('//');
    expect(glsl).not.toContain('/*');
    expect(glsl).not.toContain('offset');
  });
});
