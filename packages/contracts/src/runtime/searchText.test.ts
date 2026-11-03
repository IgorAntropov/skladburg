import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  foldSearchText,
  isSearchQueryMatched,
  normalizeSearchText,
  parseSearchQuery,
} from './searchText';

const matches = (query: string, texts: readonly string[], gtin?: string): boolean =>
  isSearchQueryMatched(parseSearchQuery(query), texts, gtin);

describe('foldSearchText', () => {
  it('lowers the case and replaces yo with ye', () => {
    expect(foldSearchText('Тёплый УГОЛ Ёлка')).toBe('теплый угол елка');
  });

  it('keeps the length for Cyrillic, Latin, digits and spaces', () => {
    const samples = ['Тёплый  угол', 'ЁЖИК-1 Apple 42', '  Яблоки\tГолден\n', 'ÀÉÎÕÜ ß Ǆ'];

    for (const sample of samples) {
      expect(foldSearchText(sample)).toHaveLength(sample.length);
    }
  });

  it('keeps a character whose lower case changes the length', () => {
    expect(foldSearchText('İ')).toHaveLength(1);
  });
});

describe('normalizeSearchText', () => {
  it('collapses whitespace runs and trims the edges', () => {
    expect(normalizeSearchText('  Голден \t\n яблоки  ')).toBe('голден яблоки');
  });

  it('answers an empty string for blank text', () => {
    expect(normalizeSearchText(' \t ')).toBe('');
  });
});

describe('parseSearchQuery', () => {
  it('splits the normalized query into words', () => {
    expect(parseSearchQuery('  Голден   ЯБЛОКИ ')).toEqual({ gtin: undefined, isEmpty: false, tokens: ['голден', 'яблоки'] });
  });

  it('marks a blank query as empty', () => {
    expect(parseSearchQuery('   ')).toEqual({ gtin: undefined, isEmpty: true, tokens: [] });
  });

  it.each(['12345670', '123456789012', '4600000000012', '04600000000012'])('takes %s as a gtin', (digits) => {
    expect(parseSearchQuery(digits).gtin).toBe(digits.replace(/^0+/, ''));
  });

  it('takes digits separated by spaces as a gtin', () => {
    expect(parseSearchQuery('4600 0000 00012').gtin).toBe('4600000000012');
  });

  const NOT_GTIN_TEXTS = ['1234567', '123456789', '123456789012345', '460000000001a', 'мол 46000000', '00000000'];

  it.each(NOT_GTIN_TEXTS)('does not take %s as a gtin', (text) => {
    expect(parseSearchQuery(text).gtin).toBeUndefined();
  });
});

describe('isSearchQueryMatched', () => {
  it('matches everything for an empty query', () => {
    expect(matches('', ['Яблоки'])).toBe(true);
    expect(matches('  ', [])).toBe(true);
  });

  it('matches the words in any order regardless of case, yo and spacing', () => {
    expect(matches('голден яблоки', ['Яблоки Голден, 1 сорт'])).toBe(true);
    expect(matches('  ЯБЛОКИ   голден ', ['Яблоки Голден, 1 сорт'])).toBe(true);
    expect(matches('теплый', ['Тёплый угол'])).toBe(true);
    expect(matches('тёплый', ['Теплый угол'])).toBe(true);
  });

  it('takes a word from any of the texts', () => {
    expect(matches('яблоки край', ['Яблоки Голден', 'Яблоневый край'])).toBe(true);
    expect(matches('яблоки каменный', ['Яблоки Голден', 'Яблоневый край'])).toBe(false);
  });

  it('requires every word', () => {
    expect(matches('яблоки груши', ['Яблоки Голден'])).toBe(false);
  });

  it('matches a gtin with or without leading zeros', () => {
    expect(matches('4600000000012', ['Молоко'], '4600000000012')).toBe(true);
    expect(matches('04600000000012', ['Молоко'], '4600000000012')).toBe(true);
    expect(matches('4600000000012', ['Молоко'], '04600000000012')).toBe(true);
    expect(matches('4600000000013', ['Молоко'], '4600000000012')).toBe(false);
  });

  it('does not match records without a gtin by a gtin query', () => {
    expect(matches('4600000000012', ['Молоко'])).toBe(false);
    expect(matches('4600000000012', ['Молоко'], '')).toBe(false);
  });

  it('searches digits that are not a gtin as a substring', () => {
    expect(matches('1234567', ['SKU-12345670'], '4600000000012')).toBe(true);
  });
});
