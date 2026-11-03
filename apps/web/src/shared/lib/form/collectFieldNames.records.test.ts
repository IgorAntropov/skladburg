import {
  describe,
  expect,
  it,
} from 'vitest';

import { collectFieldNames } from './collectFieldNames';

describe('collectFieldNames with lists of records', () => {
  it('opens every record of a list into leaf paths with the index of the record', () => {
    const names = collectFieldNames({
      tiers: [
        { minQuantity: '', price: { amountMinor: '' } },
        { minQuantity: '', price: { amountMinor: '' } },
      ],
      version: '',
    });

    expect(names).toEqual([
      'tiers.0.minQuantity',
      'tiers.0.price.amountMinor',
      'tiers.1.minQuantity',
      'tiers.1.price.amountMinor',
      'version',
    ]);
  });

  it('keeps a list of plain values and an empty list as single fields', () => {
    expect(collectFieldNames({ capabilities: [1, 2], empty: [], names: ['a'] })).toEqual(['capabilities', 'empty', 'names']);
  });
});
