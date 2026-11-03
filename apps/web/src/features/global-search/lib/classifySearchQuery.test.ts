import {
  describe,
  expect,
  it,
} from 'vitest';

import { classifySearchQuery } from './classifySearchQuery';

describe('classifySearchQuery', () => {
  it.each([
    ['', 'idle'],
    ['я', 'too-short'],
    ['я ', 'too-short'],
    ['я я', 'active'],
    ['яб', 'active'],
    ['4607001234567', 'active'],
  ])('classifies "%s" as %s', (normalizedQuery, expected) => {
    expect(classifySearchQuery(normalizedQuery)).toBe(expected);
  });
});
