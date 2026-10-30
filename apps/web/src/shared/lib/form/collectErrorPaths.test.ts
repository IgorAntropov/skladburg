import {
  describe,
  expect,
  it,
} from 'vitest';

import { collectErrorPaths } from './collectErrorPaths';

describe('collectErrorPaths', () => {
  it('returns the paths of flat field errors', () => {
    expect(collectErrorPaths({ name: { type: 'required' }, timeZone: { type: 'string.pattern' } })).toEqual([
      'name',
      'timeZone',
    ]);
  });

  it('returns the dotted paths of nested field errors', () => {
    expect(collectErrorPaths({
      bank: { bik: { type: 'string.pattern' }, details: { account: { type: 'field_check.settlement_account' } } },
      legalAddress: { type: 'required' },
    })).toEqual([
      'bank.bik',
      'bank.details.account',
      'legalAddress',
    ]);
  });

  it('returns nothing for no errors', () => {
    expect(collectErrorPaths({})).toEqual([]);
  });
});
