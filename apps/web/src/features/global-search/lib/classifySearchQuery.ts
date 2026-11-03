export type SearchQueryKindValue = 'active' | 'idle' | 'too-short';

export const MIN_SEARCH_QUERY_LENGTH = 2;

const SPACES = / /g;

export const classifySearchQuery = (normalizedQuery: string): SearchQueryKindValue => {
  if (normalizedQuery === '') {
    return 'idle';
  }

  const length = Array.from(normalizedQuery.replace(SPACES, '')).length;

  return length < MIN_SEARCH_QUERY_LENGTH ? 'too-short' : 'active';
};
