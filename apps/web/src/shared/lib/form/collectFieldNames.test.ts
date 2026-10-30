import {
  describe,
  expect,
  it,
} from 'vitest';

import { collectFieldNames } from './collectFieldNames';

describe('collectFieldNames', () => {
  it('returns the names of flat fields in the order of the values', () => {
    expect(collectFieldNames({ address: '', name: '' })).toEqual(['address', 'name']);
  });

  it('opens nested objects into dotted leaf paths', () => {
    expect(collectFieldNames({ bank: { bik: '', details: { account: '' } }, name: '' })).toEqual([
      'bank.bik',
      'bank.details.account',
      'name',
    ]);
  });

  it('keeps an array as a single field', () => {
    expect(collectFieldNames({ capabilities: [1, 2], name: '' })).toEqual(['capabilities', 'name']);
  });

  it('keeps a bigint, a date and a null as single fields', () => {
    expect(collectFieldNames({ at: new Date(0), empty: null, version: 1n })).toEqual(['at', 'empty', 'version']);
  });
});
