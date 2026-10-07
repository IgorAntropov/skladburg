import {
  describe,
  expect,
  it,
} from 'vitest';

import type { IRealTimeSource } from './realTimeSource';

import { createScaledClock } from './clock';

interface FakeRealTimeValue extends IRealTimeSource {
  advance: (deltaMs: number) => void;
}

const createFakeRealTime = (startMs: number): FakeRealTimeValue => {
  let currentMs = startMs;

  return {
    advance: (deltaMs: number): void => {
      currentMs += deltaMs;
    },
    now: (): number => currentMs,
  };
};

const WORLD_START_MS = 1_800_000_000_000;

describe('createScaledClock', () => {
  it('starts at the initial world time regardless of the real time origin', () => {
    const clock = createScaledClock({
      initial: { timeScale: 1, worldTimeMs: WORLD_START_MS },
      realTime: createFakeRealTime(987_654),
    });

    expect(clock.now()).toBe(WORLD_START_MS);
  });

  it('advances the world time by the real time elapsed multiplied by the scale', () => {
    const realTime = createFakeRealTime(5_000);
    const clock = createScaledClock({ initial: { timeScale: 60, worldTimeMs: WORLD_START_MS }, realTime });

    realTime.advance(1_500);

    expect(clock.now()).toBe(WORLD_START_MS + 90_000);
  });

  it('does not move the world time when the scale is zero', () => {
    const realTime = createFakeRealTime(0);
    const clock = createScaledClock({ initial: { timeScale: 0, worldTimeMs: WORLD_START_MS }, realTime });

    realTime.advance(10_000);

    expect(clock.now()).toBe(WORLD_START_MS);
  });

  it('keeps the world time continuous when the scale changes', () => {
    const realTime = createFakeRealTime(0);
    const clock = createScaledClock({ initial: { timeScale: 1, worldTimeMs: WORLD_START_MS }, realTime });

    realTime.advance(2_000);
    const beforeChange = clock.now();
    clock.setScale(100);

    expect(clock.now()).toBe(beforeChange);
    expect(clock.getScale()).toBe(100);

    realTime.advance(1_000);

    expect(clock.now()).toBe(beforeChange + 100_000);
  });

  it('applies each scale only to the interval it was active for', () => {
    const realTime = createFakeRealTime(0);
    const clock = createScaledClock({ initial: { timeScale: 2, worldTimeMs: 0 }, realTime });

    realTime.advance(1_000);
    clock.setScale(10);
    realTime.advance(1_000);
    clock.setScale(0);
    realTime.advance(1_000);

    expect(clock.now()).toBe(2_000 + 10_000);
  });

  it('never moves backwards when the real time source goes back', () => {
    const realTime = createFakeRealTime(10_000);
    const clock = createScaledClock({ initial: { timeScale: 1, worldTimeMs: 100 }, realTime });

    realTime.advance(-3_000);

    expect(clock.now()).toBe(100);
  });

  it('restores from a snapshot and continues from the same world time', () => {
    const realTime = createFakeRealTime(0);
    const clock = createScaledClock({ initial: { timeScale: 5, worldTimeMs: WORLD_START_MS }, realTime });

    realTime.advance(4_000);
    const snapshot = clock.getSnapshot();

    expect(snapshot).toEqual({ timeScale: 5, worldTimeMs: WORLD_START_MS + 20_000 });

    const restoredRealTime = createFakeRealTime(777_000);
    const restored = createScaledClock({ initial: snapshot, realTime: restoredRealTime });

    expect(restored.now()).toBe(snapshot.worldTimeMs);

    restoredRealTime.advance(1_000);

    expect(restored.now()).toBe(snapshot.worldTimeMs + 5_000);
  });

  it.each([
    ['negative', -1],
    ['not a number', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
  ])('rejects a scale that is %s', (_name, scale) => {
    const realTime = createFakeRealTime(0);
    const clock = createScaledClock({ initial: { timeScale: 1, worldTimeMs: 0 }, realTime });

    expect(() => {
      clock.setScale(scale);
    }).toThrow(RangeError);
    expect(() => createScaledClock({ initial: { timeScale: scale, worldTimeMs: 0 }, realTime })).toThrow(RangeError);
    expect(clock.getScale()).toBe(1);
  });

  it('rejects a world time that is not finite', () => {
    expect(() => createScaledClock({
      initial: { timeScale: 1, worldTimeMs: Number.NaN },
      realTime: createFakeRealTime(0),
    })).toThrow(RangeError);
  });

  describe('with fractional time', () => {
    const FRACTIONAL_REAL_START_MS = 1_800_000_000_000.123;
    const FRACTIONAL_STEP_MS = 0.37;
    const STEP_COUNT = 400;

    it('reports whole milliseconds that never decrease for a fractional real time source', () => {
      const realTime = createFakeRealTime(FRACTIONAL_REAL_START_MS);
      const clock = createScaledClock({ initial: { timeScale: 1, worldTimeMs: WORLD_START_MS }, realTime });
      let previous = clock.now();

      for (let step = 0; step < STEP_COUNT; step += 1) {
        realTime.advance(FRACTIONAL_STEP_MS);
        const current = clock.now();

        expect(Number.isInteger(current)).toBe(true);
        expect(Number.isInteger(clock.getSnapshot().worldTimeMs)).toBe(true);
        expect(current).toBeGreaterThanOrEqual(previous);
        previous = current;
      }

      expect(previous).toBe(WORLD_START_MS + Math.floor(STEP_COUNT * FRACTIONAL_STEP_MS));
    });

    it('reports whole milliseconds that never decrease for a fractional scale', () => {
      const realTime = createFakeRealTime(0);
      const clock = createScaledClock({ initial: { timeScale: 0.5, worldTimeMs: WORLD_START_MS }, realTime });
      let previous = clock.now();

      for (let step = 0; step < STEP_COUNT; step += 1) {
        realTime.advance(FRACTIONAL_STEP_MS);
        const current = clock.now();

        expect(Number.isInteger(current)).toBe(true);
        expect(Number.isInteger(clock.getSnapshot().worldTimeMs)).toBe(true);
        expect(current).toBeGreaterThanOrEqual(previous);
        previous = current;
      }

      expect(previous).toBe(WORLD_START_MS + Math.floor(STEP_COUNT * FRACTIONAL_STEP_MS * 0.5));
    });

    it('keeps the fractional part accumulated before a scale change', () => {
      const realTime = createFakeRealTime(0.125);
      const clock = createScaledClock({ initial: { timeScale: 0.5, worldTimeMs: 1_000 }, realTime });

      realTime.advance(3);

      expect(clock.now()).toBe(1_001);

      clock.setScale(1);

      expect(clock.now()).toBe(1_001);
      expect(Number.isInteger(clock.getSnapshot().worldTimeMs)).toBe(true);

      realTime.advance(0.5);

      expect(clock.now()).toBe(1_002);

      clock.setScale(2);
      realTime.advance(0.25);

      expect(clock.now()).toBe(1_002);

      realTime.advance(0.25);

      expect(clock.now()).toBe(1_003);
    });
  });
});
