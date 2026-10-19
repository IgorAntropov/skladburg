import {
  describe,
  expect,
  it,
} from 'vitest';

import { compareCodeUnits } from './compareCodeUnits';

describe('compareCodeUnits', () => {
  it('returns zero for equal strings', () => {
    expect(compareCodeUnits('deal_view', 'deal_view')).toBe(0);
  });

  it('orders by code units, not by locale', () => {
    expect(compareCodeUnits('B', 'a')).toBeLessThan(0);
    expect(compareCodeUnits('a9', 'a_')).toBeLessThan(0);
    expect(compareCodeUnits('a_', 'a9')).toBeGreaterThan(0);
  });

  it('sorts a list the same way on every runtime', () => {
    expect(['b', 'a_b', 'ab', 'B'].sort(compareCodeUnits)).toEqual(['B', 'a_b', 'ab', 'b']);
  });
});
