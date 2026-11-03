import {
  describe,
  expect,
  it,
} from 'vitest';

import { cloneFormRecord } from './cloneFormRecord';

describe('cloneFormRecord with lists of records', () => {
  it('copies the records of a list so that a change of the copy does not reach the source', () => {
    const source = { tiers: [{ price: { amountMinor: '8950' } }, { price: { amountMinor: '' } }] };
    const clone = cloneFormRecord(source);

    expect(clone).toEqual(source);
    expect(clone.tiers).not.toBe(source.tiers);

    Reflect.set(source.tiers[0]?.price ?? {}, 'amountMinor', '1');

    expect(clone).toEqual({ tiers: [{ price: { amountMinor: '8950' } }, { price: { amountMinor: '' } }] });
  });
});
