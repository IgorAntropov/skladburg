import type { SearchQueryValue } from '@skladburg/contracts/runtime';

import {
  compareCodeUnits,
  normalizeSearchText,
} from '@skladburg/contracts/runtime';

import type { SearchOptionValue } from '../model/searchResultTypes';

export const SEARCH_GROUP_LIMIT = 5;

const SEARCH_COLLATOR = new Intl.Collator('ru');
const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u;

const MatchRank = {
  EXACT: 1,
  GTIN: 0,
  SUBSTRING: 4,
  TITLE_PREFIX: 2,
  WORD_PREFIX: 3,
} as const;

export interface RankedSearchOptionsValue {
  hasMore: boolean;
  options: readonly SearchOptionValue[];
}

export interface RankSearchOptionsInputValue {
  candidates: readonly SearchCandidateValue[];
  hasNextPage: boolean;
  limit?: number | undefined;
  query: SearchQueryValue;
}

export interface SearchCandidateValue {
  isGtinMatched: boolean;
  option: SearchOptionValue;
  rankText: string;
}

type MatchRankValue = (typeof MatchRank)[keyof typeof MatchRank];

const isEveryTokenWordPrefix = (words: readonly string[], tokens: readonly string[]): boolean => (
  tokens.every(token => words.some(word => word.startsWith(token)))
);

const getMatchRank = (candidate: SearchCandidateValue, query: SearchQueryValue): MatchRankValue => {
  if (candidate.isGtinMatched) {
    return MatchRank.GTIN;
  }

  const normalizedTitle = normalizeSearchText(candidate.rankText);
  const normalizedQuery = query.tokens.join(' ');

  if (normalizedTitle === normalizedQuery) {
    return MatchRank.EXACT;
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return MatchRank.TITLE_PREFIX;
  }

  const words = normalizedTitle.split(WORD_SEPARATOR);

  return isEveryTokenWordPrefix(words, query.tokens) ? MatchRank.WORD_PREFIX : MatchRank.SUBSTRING;
};

export const rankSearchOptions = ({
  candidates,
  hasNextPage,
  limit = SEARCH_GROUP_LIMIT,
  query,
}: RankSearchOptionsInputValue): RankedSearchOptionsValue => {
  const ranked = candidates
    .map(candidate => ({ candidate, rank: getMatchRank(candidate, query) }))
    .toSorted((current, prev) => (
      current.rank - prev.rank
      || SEARCH_COLLATOR.compare(current.candidate.option.title, prev.candidate.option.title)
      || compareCodeUnits(current.candidate.option.objectId, prev.candidate.option.objectId)
    ));

  return {
    hasMore: hasNextPage || ranked.length > limit,
    options: ranked.slice(0, limit).map(entry => entry.candidate.option),
  };
};
