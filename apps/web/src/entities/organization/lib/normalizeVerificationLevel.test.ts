import {
  describe,
  expect,
  it,
} from 'vitest';

import { normalizeVerificationLevel } from './normalizeVerificationLevel';

describe('normalizeVerificationLevel', () => {
  it.each([0, 1, 2, 3, 4])('keeps the level %i', (level) => {
    expect(normalizeVerificationLevel(level)).toBe(level);
  });

  it.each([
    [Number.NaN, 0],
    [-3, 0],
    [7, 4],
    [Number.POSITIVE_INFINITY, 4],
    [Number.NEGATIVE_INFINITY, 0],
    [2.9, 2],
    [-0.5, 0],
  ])('turns %s into %i', (level, expected) => {
    expect(normalizeVerificationLevel(level)).toBe(expected);
  });
});
