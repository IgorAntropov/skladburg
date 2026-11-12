import {
  expect,
  it,
} from 'vitest';

import { selectWholeUnits } from './outboundSelection';

it('finds an exact set when the earliest lot alone would leave an impossible remainder', () => {
  expect(selectWholeUnits([7n, 6n, 4n, 10n], 10n)).toEqual([1, 2]);
});

it('uses the earliest eligible units and preserves integer precision', () => {
  expect(selectWholeUnits([9_007_199_254_740_993n, 5n, 9_007_199_254_740_998n], 9_007_199_254_740_998n)).toEqual([0, 1]);
  expect(selectWholeUnits([7n, 6n, 4n], 8n)).toBeUndefined();
});

it('finds the exact unit after an expensive search through quantities that cannot make the odd demand', () => {
  const even = Array.from({ length: 22 }, (_, index) => 2n << BigInt(index));

  expect(selectWholeUnits([...even, 4_000_001n], 4_000_001n)).toEqual([22]);
});
