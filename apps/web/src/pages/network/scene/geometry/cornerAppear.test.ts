import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createCornerAnimation,
  isCornerAppearFinished,
  resolveCornerSpread,
  stepCornerAnimation,
} from './cornerAppear';

describe('resolveCornerSpread', () => {
  it('starts 0.3 m out and ends on the place after 140 ms', () => {
    expect(resolveCornerSpread(0)).toBeCloseTo(0.3, 9);
    expect(resolveCornerSpread(0.14)).toBe(0);
    expect(resolveCornerSpread(1)).toBe(0);
  });

  it('eases out: fast first, slow near the place', () => {
    const early = resolveCornerSpread(0.035);
    const late = resolveCornerSpread(0.105);

    expect(0.3 - early).toBeGreaterThan(early - late);
    expect(early).toBeGreaterThan(late);
    expect(resolveCornerSpread(0.07)).toBeCloseTo(0.3 * 0.125, 9);
  });

  it('never goes out of the range for a negative time', () => {
    expect(resolveCornerSpread(-1)).toBeCloseTo(0.3, 9);
  });
});

describe('isCornerAppearFinished', () => {
  it('finishes at 140 ms', () => {
    expect(isCornerAppearFinished(0.139)).toBe(false);
    expect(isCornerAppearFinished(0.14)).toBe(true);
  });
});

describe('stepCornerAnimation', () => {
  it('draws the first frame at the full offset whatever time has passed since the last frame', () => {
    const animation = createCornerAnimation(true);

    expect(stepCornerAnimation(animation, 5)).toBeCloseTo(0.3, 9);
    expect(animation.isActive).toBe(true);
  });

  it('moves the corners in by the time of each frame and stops after 140 ms', () => {
    const animation = createCornerAnimation(true);
    const spreads = [stepCornerAnimation(animation, 0)];

    for (let frame = 0; frame < 4; frame += 1) {
      spreads.push(stepCornerAnimation(animation, 0.0167));
    }

    expect(spreads.every((spread, index) => index === 0 || spread < (spreads[index - 1] ?? 0))).toBe(true);
    expect(animation.isActive).toBe(true);

    for (let frame = 0; frame < 5; frame += 1) {
      stepCornerAnimation(animation, 0.0167);
    }

    expect(animation.isActive).toBe(false);
    expect(stepCornerAnimation(animation, 0.0167)).toBe(0);
  });

  it('does not let one long frame skip the animation', () => {
    const animation = createCornerAnimation(true);

    stepCornerAnimation(animation, 0);
    stepCornerAnimation(animation, 2);

    expect(animation.elapsed).toBeCloseTo(1 / 30, 9);
    expect(animation.isActive).toBe(true);
  });

  it('ignores a negative frame time', () => {
    const animation = createCornerAnimation(true);

    stepCornerAnimation(animation, 0);
    stepCornerAnimation(animation, -1);

    expect(animation.elapsed).toBe(0);
  });
});
