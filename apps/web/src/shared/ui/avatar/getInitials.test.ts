import {
  describe,
  expect,
  it,
} from 'vitest';

import { getInitials } from './getInitials';

describe('getInitials', () => {
  it('takes the first letters of two words in upper case', () => {
    expect(getInitials('Анна Смирнова')).toBe('АС');
    expect(getInitials('anna smirnova')).toBe('AS');
  });

  it('takes one letter from a single word', () => {
    expect(getInitials('Анна')).toBe('А');
  });

  it('returns an empty string for an empty or blank name', () => {
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
    expect(getInitials(' \t\n ')).toBe('');
  });

  it('ignores extra spaces around and between words', () => {
    expect(getInitials('  Анна    Смирнова  ')).toBe('АС');
  });

  it('uses only the first two words', () => {
    expect(getInitials('Анна Мария Смирнова')).toBe('АМ');
  });

  it('keeps a hyphenated word as one word', () => {
    expect(getInitials('Анна-Мария Смирнова')).toBe('АС');
    expect(getInitials('Смирнова Анна-Мария')).toBe('СА');
  });

  it('does not make a word from a lone hyphen or a punctuation mark', () => {
    expect(getInitials('Анна - Смирнова')).toBe('АС');
    expect(getInitials('- Анна')).toBe('А');
    expect(getInitials('-')).toBe('');
  });

  it('skips leading punctuation inside a word', () => {
    expect(getInitials('(Анна) «Смирнова»')).toBe('АС');
  });

  it('keeps the letter Ё', () => {
    expect(getInitials('Ёлкин Пётр')).toBe('ЁП');
    expect(getInitials('ёлкин')).toBe('Ё');
  });

  it('counts a digit as an initial', () => {
    expect(getInitials('2 Склад')).toBe('2С');
  });

  it('does not split a character outside the basic plane', () => {
    expect(getInitials('𝒜nna')).toBe('𝒜');
  });
});
