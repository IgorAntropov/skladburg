import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ISOMETRIC_AZIMUTH_RADIANS,
  QUARTER_TURN_RADIANS,
} from './cameraConstants';
import {
  azimuthForTurn,
  homeTurn,
  nextTurn,
} from './cameraTurns';

describe('azimuthForTurn', () => {
  it('starts at the isometric azimuth and adds a quarter turn per step', () => {
    expect(azimuthForTurn(0)).toBe(ISOMETRIC_AZIMUTH_RADIANS);
    expect(azimuthForTurn(1)).toBe(ISOMETRIC_AZIMUTH_RADIANS + QUARTER_TURN_RADIANS);
    expect(azimuthForTurn(-1)).toBe(ISOMETRIC_AZIMUTH_RADIANS - QUARTER_TURN_RADIANS);
  });

  it('does not wrap the turn so that going past a full revolution keeps turning the same way', () => {
    expect(azimuthForTurn(4)).toBeGreaterThan(azimuthForTurn(3));
    expect(azimuthForTurn(4) - azimuthForTurn(3)).toBeCloseTo(QUARTER_TURN_RADIANS, 12);
  });

  it('accumulates no error after twenty turns in a row', () => {
    let turn = 0;

    for (let step = 0; step < 20; step += 1) {
      turn = nextTurn(turn, 1);
    }

    expect(turn).toBe(20);
    expect(azimuthForTurn(turn)).toBe(ISOMETRIC_AZIMUTH_RADIANS + 20 * QUARTER_TURN_RADIANS);
    expect(azimuthForTurn(turn) % (2 * Math.PI)).toBeCloseTo(ISOMETRIC_AZIMUTH_RADIANS, 12);
  });

  it('lands on the same azimuth as direct jumps when presses interleave in any order', () => {
    const presses: (-1 | 1)[] = [1, 1, -1, 1, 1, 1, -1, -1, 1, 1, 1, 1, -1, 1];
    const expectedTurn = presses.reduce<number>((total, direction) => total + direction, 0);

    const turn = presses.reduce<number>((current, direction) => nextTurn(current, direction), 0);

    expect(turn).toBe(expectedTurn);
    expect(azimuthForTurn(turn)).toBe(azimuthForTurn(expectedTurn));
  });
});

describe('homeTurn', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 4],
    [3, 4],
    [4, 4],
    [5, 4],
    [6, 8],
    [-1, 0],
    [-2, 0],
    [-3, -4],
    [-6, -4],
    [-7, -8],
  ])('takes turn %s to the nearest full revolution %s', (turn, expected) => {
    expect(homeTurn(turn)).toBe(expected);
  });

  it('never turns the camera by more than a half revolution', () => {
    for (let turn = -20; turn <= 20; turn += 1) {
      expect(Math.abs(homeTurn(turn) - turn)).toBeLessThanOrEqual(2);
    }
  });

  it('returns a plain zero rather than a negative zero', () => {
    expect(Object.is(homeTurn(-1), 0)).toBe(true);
  });
});
