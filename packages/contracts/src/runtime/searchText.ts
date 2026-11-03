const SEARCH_LOCALE = 'ru';
const GTIN_LENGTHS: ReadonlySet<number> = new Set([8, 12, 13, 14]);
const WHITESPACE_RUN = /\s+/g;
const DIGITS_ONLY = /^\d+$/;
const LEADING_ZEROS = /^0+/;
const ANY_CHARACTER = /[\s\S]/gu;

export interface SearchQueryValue {
  gtin: string | undefined;
  isEmpty: boolean;
  tokens: readonly string[];
}

const foldCharacter = (character: string): string => {
  const folded = character.toLocaleLowerCase(SEARCH_LOCALE);

  if (folded.length !== character.length) {
    return character;
  }

  return folded === 'ё' ? 'е' : folded;
};

const stripLeadingZeros = (digits: string): string => digits.replace(LEADING_ZEROS, '');

export const foldSearchText = (text: string): string => text.replace(ANY_CHARACTER, foldCharacter);

export const normalizeSearchText = (text: string): string =>
  foldSearchText(text).replace(WHITESPACE_RUN, ' ').trim();

export const parseSearchQuery = (query: string): SearchQueryValue => {
  const normalized = normalizeSearchText(query);
  const compact = normalized.replace(WHITESPACE_RUN, '');
  const isGtinShaped = DIGITS_ONLY.test(compact) && GTIN_LENGTHS.has(compact.length);
  const gtin = isGtinShaped ? stripLeadingZeros(compact) : '';

  return {
    gtin: gtin === '' ? undefined : gtin,
    isEmpty: normalized === '',
    tokens: normalized === '' ? [] : normalized.split(' '),
  };
};

export const isSearchQueryMatched = (query: SearchQueryValue, texts: readonly string[], gtin?: string): boolean => {
  if (query.isEmpty) {
    return true;
  }

  if (query.gtin !== undefined && gtin !== undefined && gtin !== '' && stripLeadingZeros(gtin) === query.gtin) {
    return true;
  }

  const normalizedTexts = texts.map(normalizeSearchText);

  return query.tokens.every(token => normalizedTexts.some(text => text.includes(token)));
};
