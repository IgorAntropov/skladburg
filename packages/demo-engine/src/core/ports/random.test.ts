import {
  describe,
  expect,
  it,
} from 'vitest';

import type { IRandom } from './random';

import {
  createRandom,
  createSeededRandom,
} from './random';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const draw = (random: IRandom, count: number): number[] => Array.from({ length: count }, () => random.next());

describe('createSeededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    expect(draw(createSeededRandom(42), 50)).toEqual(draw(createSeededRandom(42), 50));
  });

  it('gives a different sequence for a different seed', () => {
    expect(draw(createSeededRandom(42), 50)).not.toEqual(draw(createSeededRandom(43), 50));
  });

  it('gives a different sequence for seed zero and seed one', () => {
    expect(draw(createSeededRandom(0), 10)).not.toEqual(draw(createSeededRandom(1), 10));
  });

  it('produces floats in the half-open range from zero to one', () => {
    const values = draw(createSeededRandom(7), 5_000);

    expect(values.every(value => value >= 0 && value < 1)).toBe(true);
  });

  it('spreads floats over the range', () => {
    const values = draw(createSeededRandom(7), 5_000);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it('rejects a seed that is not an integer', () => {
    expect(() => createSeededRandom(1.5)).toThrow(RangeError);
    expect(() => createSeededRandom(Number.NaN)).toThrow(RangeError);
  });
});

describe('nextInt', () => {
  it('stays below the exclusive upper bound and reaches every value', () => {
    const random = createSeededRandom(11);
    const values = Array.from({ length: 2_000 }, () => random.nextInt(6));

    expect(values.every(value => Number.isInteger(value) && value >= 0 && value < 6)).toBe(true);
    expect(new Set(values)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });

  it('always returns zero for the bound of one', () => {
    const random = createSeededRandom(11);

    expect(Array.from({ length: 20 }, () => random.nextInt(1))).toEqual(Array.from({ length: 20 }, () => 0));
  });

  it('is repeatable for the same seed', () => {
    const first = createSeededRandom(5);
    const second = createSeededRandom(5);

    expect(Array.from({ length: 30 }, () => first.nextInt(1_000))).toEqual(Array.from({ length: 30 }, () => second.nextInt(1_000)));
  });

  it.each([0, -1, 2.5, Number.NaN, 4294967297])('rejects the bound %s', (bound) => {
    expect(() => createSeededRandom(1).nextInt(bound)).toThrow(RangeError);
  });
});

describe('uuid', () => {
  it('has the version 4 and variant bits in the right places', () => {
    const random = createSeededRandom(99);

    for (let index = 0; index < 200; index += 1) {
      expect(random.uuid()).toMatch(UUID_V4_PATTERN);
    }
  });

  it('is repeatable for the same seed and different for a different one', () => {
    expect(createSeededRandom(3).uuid()).toBe(createSeededRandom(3).uuid());
    expect(createSeededRandom(3).uuid()).not.toBe(createSeededRandom(4).uuid());
  });

  it('does not repeat within one sequence', () => {
    const random = createSeededRandom(3);
    const identifiers = new Set(Array.from({ length: 1_000 }, () => random.uuid()));

    expect(identifiers.size).toBe(1_000);
  });
});

describe('state snapshot and restore', () => {
  it('continues the sequence exactly where the snapshot was taken', () => {
    const original = createSeededRandom(2026);
    draw(original, 17);
    original.uuid();
    const state = original.getState();

    const restored = createRandom(state);

    expect(draw(restored, 40)).toEqual(draw(original, 40));
    expect(restored.uuid()).toBe(original.uuid());
    expect(restored.nextInt(1_000)).toBe(original.nextInt(1_000));
  });

  it.each([20261012, 0, 1, 42, 2026, 4294967295])('keeps four uint32 and resumes the same sequence for the seed %i', (seed) => {
    const original = createSeededRandom(seed);

    for (let step = 0; step < 300; step += 1) {
      original.next();
      const state = original.getState();

      expect([state.a, state.b, state.c, state.d].every(part => Number.isInteger(part) && part >= 0 && part < 4294967296)).toBe(true);

      if (step % 50 === 0) {
        const restored = createRandom(state);

        expect(restored.getState()).toEqual(state);
        expect(draw(restored, 20)).toEqual(draw(original, 20));
      }
    }
  });

  it('returns a state that survives structured cloning', () => {
    const random = createSeededRandom(8);
    draw(random, 5);

    expect(structuredClone(random.getState())).toEqual(random.getState());
  });

  it('does not let a returned state change the generator', () => {
    const random = createSeededRandom(8);
    const state = random.getState();
    const expected = draw(createRandom(state), 5);

    state.a = 0;

    expect(draw(random, 5)).toEqual(expected);
  });

  it('changes the state with every draw', () => {
    const random = createSeededRandom(8);
    const before = random.getState();
    random.next();

    expect(random.getState()).not.toEqual(before);
  });

  it('rejects a state that is not four unsigned 32-bit integers', () => {
    expect(() => createRandom({ a: -1, b: 0, c: 0, d: 0 })).toThrow(RangeError);
    expect(() => createRandom({ a: 0, b: 1.5, c: 0, d: 0 })).toThrow(RangeError);
    expect(() => createRandom({ a: 0, b: 0, c: 4294967296, d: 0 })).toThrow(RangeError);
  });
});
