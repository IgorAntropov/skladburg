import {
  describe,
  expect,
  it,
} from 'vitest';

import { cloneFormRecord } from './cloneFormRecord';

describe('cloneFormRecord', () => {
  it('copies nested objects into new objects with the same content', () => {
    const source = { bank: { bik: '040000501' }, name: 'a' };
    const clone = cloneFormRecord(source);

    expect(clone).toEqual(source);
    expect(clone).not.toBe(source);
    expect(clone.bank).not.toBe(source.bank);
  });

  it('keeps arrays and other values as they are', () => {
    const list = [1, 2];
    const clone = cloneFormRecord({ list, version: 1n });

    expect(clone.list).toBe(list);
    expect(clone.version).toBe(1n);
  });
});
