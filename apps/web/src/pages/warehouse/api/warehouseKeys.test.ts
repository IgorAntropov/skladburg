import {
  describe,
  expect,
  it,
} from 'vitest';

import { warehouseKeys } from './warehouseKeys';

describe('warehouseKeys', () => {
  it('builds the list key from the organization', () => {
    expect(warehouseKeys.list('a')).toEqual(['warehouse', 'list', 'a']);
  });

  it('separates organizations', () => {
    expect(warehouseKeys.list('a')).not.toEqual(warehouseKeys.list('b'));
  });
});
