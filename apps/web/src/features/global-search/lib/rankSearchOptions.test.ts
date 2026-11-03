import { parseSearchQuery } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SearchOptionValue } from '../model/searchResultTypes';
import type { SearchCandidateValue } from './rankSearchOptions';

import { rankSearchOptions } from './rankSearchOptions';

const createCandidate = (
  objectId: string,
  title: string,
  override: Partial<SearchCandidateValue> = {},
): SearchCandidateValue => {
  const option: SearchOptionValue = {
    address: { kind: 'object', object: { id: objectId, type: 'listing' } },
    detail: { isPublished: true, kind: 'own-listing' },
    detailMatches: [],
    groupId: 'own-listings',
    objectId,
    title,
    titleMatches: [],
  };

  return { isGtinMatched: false, option, rankText: title, ...override };
};

const rankIds = (candidates: readonly SearchCandidateValue[], text: string, hasNextPage = false): string[] => (
  rankSearchOptions({ candidates, hasNextPage, query: parseSearchQuery(text) }).options.map(option => option.objectId)
);

describe('rankSearchOptions', () => {
  it('puts an exact match before a title start, a word start and a substring', () => {
    const candidates = [
      createCandidate('substring', 'Суперяблоки'),
      createCandidate('word', 'Голден яблоки'),
      createCandidate('title', 'Яблоки Голден'),
      createCandidate('exact', 'Яблоки'),
    ];

    expect(rankIds(candidates, 'яблоки')).toEqual(['exact', 'title', 'word', 'substring']);
  });

  it('ranks a substring inside a word below a word start', () => {
    const candidates = [createCandidate('inside', 'Подъяблоком'), createCandidate('start', 'Сладкие яблоки')];

    expect(rankIds(candidates, 'яблок')).toEqual(['start', 'inside']);
  });

  it('puts a GTIN match before an exact title match', () => {
    const candidates = [
      createCandidate('exact', '4607001234567'),
      createCandidate('gtin', 'Яблоки', { isGtinMatched: true }),
    ];

    expect(rankIds(candidates, '4607001234567')).toEqual(['gtin', 'exact']);
  });

  it('treats yo and ye alike and ignores case when ranking', () => {
    const candidates = [createCandidate('later', 'Новый тёплый угол'), createCandidate('first', 'Тёплый угол')];

    expect(rankIds(candidates, 'ТЕПЛЫЙ')).toEqual(['first', 'later']);
  });

  it('ranks a query of several words in any order as a word start', () => {
    const candidates = [createCandidate('substring', 'Мегаяблоки голден'), createCandidate('words', 'Яблоки Голден')];

    expect(rankIds(candidates, 'голден яблоки')).toEqual(['words', 'substring']);
  });

  it('breaks a tie by the Russian alphabet and then by id', () => {
    const candidates = [
      createCandidate('b', 'Ёж'),
      createCandidate('d', 'Еда'),
      createCandidate('c', 'Яблоко'),
      createCandidate('a', 'Яблоко'),
    ];

    const query = parseSearchQuery('');

    expect(
      rankSearchOptions({ candidates, hasNextPage: false, query }).options.map(option => option.objectId),
    ).toEqual(['d', 'b', 'a', 'c']);
  });

  it('ranks by the rank text instead of the title when they differ', () => {
    const candidates = [
      createCandidate('far', 'Агро', { rankText: 'Ростов-на-Дону' }),
      createCandidate('near', 'Яблоко', { rankText: 'Ростов' }),
    ];

    expect(rankIds(candidates, 'ростов')).toEqual(['near', 'far']);
  });

  it('keeps five options and reports more when there are six', () => {
    const candidates = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => createCandidate(id, `Яблоки ${id}`));

    const ranked = rankSearchOptions({ candidates, hasNextPage: false, query: parseSearchQuery('яблоки') });

    expect(ranked.options).toHaveLength(5);
    expect(ranked.hasMore).toBe(true);
  });

  it('reports no more for exactly five options', () => {
    const candidates = ['a', 'b', 'c', 'd', 'e'].map(id => createCandidate(id, `Яблоки ${id}`));

    const ranked = rankSearchOptions({ candidates, hasNextPage: false, query: parseSearchQuery('яблоки') });

    expect(ranked.options).toHaveLength(5);
    expect(ranked.hasMore).toBe(false);
  });

  it('reports more when the server has a next page', () => {
    const ranked = rankSearchOptions({
      candidates: [createCandidate('a', 'Яблоки')],
      hasNextPage: true,
      query: parseSearchQuery('яблоки'),
    });

    expect(ranked.hasMore).toBe(true);
  });

  it('returns nothing for no candidates', () => {
    expect(rankIds([], 'яблоки')).toEqual([]);
  });
});
