import {
  describe,
  expect,
  it,
} from 'vitest';

import type { IDayNightTween } from './createDayNightTween';

import { createDayNightTween } from './createDayNightTween';

const DURATION_MS = 2500;

const createTween = (initialValue: number): IDayNightTween => {
  return createDayNightTween({ durationMs: DURATION_MS, initialValue });
};

describe('createDayNightTween', () => {
  it('starts at the initial value and rests', () => {
    const tween = createTween(0.25);

    expect(tween.value).toBe(0.25);
    expect(tween.advance(1000)).toBe(false);
    expect(tween.value).toBe(0.25);
  });

  it('runs the full path in the full duration', () => {
    const tween = createTween(0);
    tween.setTarget(1, 1000, false);

    expect(tween.advance(1000)).toBe(true);
    expect(tween.value).toBe(0);
    expect(tween.advance(1000 + DURATION_MS - 1)).toBe(true);
    expect(tween.value).toBeLessThan(1);
    expect(tween.advance(1000 + DURATION_MS)).toBe(false);
    expect(tween.value).toBe(1);
  });

  it('runs the way back in the full duration', () => {
    const tween = createTween(1);
    tween.setTarget(0, 0, false);

    expect(tween.advance(DURATION_MS - 1)).toBe(true);
    expect(tween.advance(DURATION_MS)).toBe(false);
    expect(tween.value).toBe(0);
  });

  it('eases in and out symmetrically around the middle', () => {
    const tween = createTween(0);
    tween.setTarget(1, 0, false);

    tween.advance(DURATION_MS * 0.25);
    const early = tween.value;
    tween.advance(DURATION_MS * 0.5);
    const middle = tween.value;
    tween.advance(DURATION_MS * 0.75);
    const late = tween.value;

    expect(middle).toBeCloseTo(0.5, 6);
    expect(early).toBeLessThan(0.25);
    expect(early + late).toBeCloseTo(1, 6);
  });

  it('never moves backwards on the way to the target', () => {
    const tween = createTween(0);
    tween.setTarget(1, 0, false);
    let previous = 0;

    for (let nowMs = 0; nowMs <= DURATION_MS; nowMs += 25) {
      tween.advance(nowMs);

      expect(tween.value).toBeGreaterThanOrEqual(previous);
      previous = tween.value;
    }
  });

  it('shortens the duration in proportion to the remaining distance', () => {
    const tween = createTween(0);
    tween.setTarget(1, 0, false);
    tween.advance(DURATION_MS * 0.5);
    tween.setTarget(0, DURATION_MS * 0.5, false);
    const half = DURATION_MS * 0.5;

    expect(tween.advance(DURATION_MS * 0.5 + half - 1)).toBe(true);
    expect(tween.advance(DURATION_MS * 0.5 + half)).toBe(false);
    expect(tween.value).toBe(0);
  });

  it('turns around in the middle of a transition without a jump', () => {
    const tween = createTween(0);
    tween.setTarget(1, 0, false);
    tween.advance(900);
    const beforeTurn = tween.value;

    tween.setTarget(0, 900, false);

    expect(tween.value).toBe(beforeTurn);
    expect(tween.advance(900)).toBe(true);
    expect(tween.value).toBeCloseTo(beforeTurn, 9);

    tween.advance(1200);
    expect(tween.value).toBeLessThan(beforeTurn);
    expect(tween.advance(900 + DURATION_MS * beforeTurn)).toBe(false);
    expect(tween.value).toBe(0);
  });

  it('keeps going when the same target is set again during a transition', () => {
    const tween = createTween(0);
    tween.setTarget(1, 0, false);
    tween.advance(1000);
    const midway = tween.value;

    tween.setTarget(1, 1000, false);
    tween.advance(1000);

    expect(tween.value).toBe(midway);
    expect(tween.advance(DURATION_MS)).toBe(false);
    expect(tween.value).toBe(1);
  });

  it('does nothing when the target is already reached', () => {
    const tween = createTween(1);
    tween.setTarget(1, 500, false);

    expect(tween.advance(600)).toBe(false);
    expect(tween.value).toBe(1);
  });

  it('jumps to the target at once in the instant mode', () => {
    const tween = createTween(0);
    tween.setTarget(1, 0, true);

    expect(tween.value).toBe(1);
    expect(tween.advance(10)).toBe(false);
    expect(tween.value).toBe(1);
  });

  it('cancels a running transition in the instant mode', () => {
    const tween = createTween(0);
    tween.setTarget(1, 0, false);
    tween.advance(500);
    tween.setTarget(0, 500, true);

    expect(tween.value).toBe(0);
    expect(tween.advance(600)).toBe(false);
    expect(tween.value).toBe(0);
  });

  it('reaches the target on the first frame after a long gap', () => {
    const tween = createTween(0);
    tween.setTarget(1, 0, false);

    expect(tween.advance(10 * 60 * 1000)).toBe(false);
    expect(tween.value).toBe(1);
  });

  it('rests after the transition is over', () => {
    const tween = createTween(0);
    tween.setTarget(1, 0, false);
    tween.advance(DURATION_MS);

    expect(tween.advance(DURATION_MS + 16)).toBe(false);
    expect(tween.value).toBe(1);
  });
});
