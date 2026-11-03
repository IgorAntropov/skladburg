import type { SearchQueryValue } from '@skladburg/contracts/runtime';

import { foldSearchText } from '@skladburg/contracts/runtime';

import type { MatchRangeValue } from '../model/searchResultTypes';

const collectTokenRanges = (foldedText: string, token: string): MatchRangeValue[] => {
  const ranges: MatchRangeValue[] = [];
  let start = foldedText.indexOf(token);

  while (start !== -1) {
    ranges.push({ end: start + token.length, start });
    start = foldedText.indexOf(token, start + 1);
  }

  return ranges;
};

const mergeRanges = (ranges: readonly MatchRangeValue[]): MatchRangeValue[] => {
  const sorted = ranges.toSorted((current, prev) => current.start - prev.start || current.end - prev.end);
  const merged: MatchRangeValue[] = [];

  for (const range of sorted) {
    const last = merged.at(-1);

    if (last !== undefined && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    }
    else {
      merged.push({ ...range });
    }
  }

  return merged;
};

export const findMatchRanges = (text: string, query: SearchQueryValue): MatchRangeValue[] => {
  if (query.isEmpty || text === '') {
    return [];
  }

  const foldedText = foldSearchText(text);

  return mergeRanges(query.tokens.flatMap(token => collectTokenRanges(foldedText, token)));
};
