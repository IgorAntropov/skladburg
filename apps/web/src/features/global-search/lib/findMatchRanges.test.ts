import { parseSearchQuery } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { findMatchRanges } from './findMatchRanges';

describe('findMatchRanges', () => {
  it('returns the range of a word inside the original title', () => {
    expect(findMatchRanges('Яблоки Голден', parseSearchQuery('голден'))).toEqual([{ end: 13, start: 7 }]);
  });

  it('matches the letter yo without shifting the offsets', () => {
    expect(findMatchRanges('Тёплый угол', parseSearchQuery('теплый'))).toEqual([{ end: 6, start: 0 }]);
    expect(findMatchRanges('Тёплый угол', parseSearchQuery('угол'))).toEqual([{ end: 11, start: 7 }]);
  });

  it('matches an ye in the query against a yo in the title and the other way round', () => {
    expect(findMatchRanges('Ёлка', parseSearchQuery('елка'))).toEqual([{ end: 4, start: 0 }]);
    expect(findMatchRanges('Елка', parseSearchQuery('ёлка'))).toEqual([{ end: 4, start: 0 }]);
  });

  it('returns the ranges of several words in the order of the title', () => {
    expect(findMatchRanges('Яблоки Голден', parseSearchQuery('голден яблоки'))).toEqual([
      { end: 6, start: 0 },
      { end: 13, start: 7 },
    ]);
  });

  it('finds every occurrence of a repeated word', () => {
    expect(findMatchRanges('Мир мир мир', parseSearchQuery('мир'))).toEqual([
      { end: 3, start: 0 },
      { end: 7, start: 4 },
      { end: 11, start: 8 },
    ]);
  });

  it('merges overlapping ranges of different words', () => {
    expect(findMatchRanges('Мясной цех', parseSearchQuery('мясн ясной'))).toEqual([{ end: 6, start: 0 }]);
  });

  it('merges ranges that touch each other', () => {
    expect(findMatchRanges('Тёплый', parseSearchQuery('теп лый'))).toEqual([{ end: 6, start: 0 }]);
  });

  it('merges the occurrences of a word that overlap themselves', () => {
    expect(findMatchRanges('ааа', parseSearchQuery('аа'))).toEqual([{ end: 3, start: 0 }]);
  });

  it('ignores the extra spaces of the query', () => {
    expect(findMatchRanges('Яблоки Голден', parseSearchQuery('  яблоки   '))).toEqual([{ end: 6, start: 0 }]);
  });

  it('keeps the offsets after several spaces inside the title', () => {
    expect(findMatchRanges('Яблоки   Голден', parseSearchQuery('голден'))).toEqual([{ end: 15, start: 9 }]);
  });

  it('returns nothing for an empty query, an empty text or a missing match', () => {
    expect(findMatchRanges('Яблоки', parseSearchQuery('   '))).toEqual([]);
    expect(findMatchRanges('', parseSearchQuery('яблоки'))).toEqual([]);
    expect(findMatchRanges('Яблоки', parseSearchQuery('груши'))).toEqual([]);
  });

  it('does not mutate the ranges between calls', () => {
    const query = parseSearchQuery('яб');

    expect(findMatchRanges('Яблоки', query)).toEqual(findMatchRanges('Яблоки', query));
  });
});
