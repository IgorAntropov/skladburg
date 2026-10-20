import {
  describe,
  expect,
  it,
} from 'vitest';

import { areFormValuesEqual } from './areFormValuesEqual';

describe('areFormValuesEqual', () => {
  it.each<[string, unknown, unknown, boolean]>([
    ['the same text', 'Москва', 'Москва', true],
    ['different texts', 'Москва', 'Тула', false],
    ['an absent and an empty value', undefined, '', false],
    ['equal 64-bit integers', 10n, 10n, true],
    ['different 64-bit integers', 10n, 11n, false],
    ['equal lists', ['a', 'b'], ['a', 'b'], true],
    ['lists in another order', ['a', 'b'], ['b', 'a'], false],
    ['lists of another length', ['a'], ['a', 'b'], false],
    ['equal nested records', { item: { name: 'a', tags: ['x'] } }, { item: { name: 'a', tags: ['x'] } }, true],
    ['records with another key', { name: 'a' }, { title: 'a' }, false],
    ['records with another count of keys', { name: 'a' }, { name: 'a', title: undefined }, false],
    ['a list and a record', [], {}, false],
  ])('compares %s', (_name, current, prev, expected) => {
    expect(areFormValuesEqual(current, prev)).toBe(expected);
  });
});
