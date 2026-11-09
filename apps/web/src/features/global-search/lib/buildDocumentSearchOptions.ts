import type { SearchQueryValue } from '@skladburg/contracts/runtime';

import { isSearchQueryMatched } from '@skladburg/contracts/runtime';

import type { DocumentIndexEntryValue } from '@/entities/document';

import type { SearchCandidateValue } from './rankSearchOptions';

import { findMatchRanges } from './findMatchRanges';

export const buildDocumentSearchOptions = (
  entries: readonly DocumentIndexEntryValue[],
  query: SearchQueryValue,
): SearchCandidateValue[] => {
  const tokens = query.tokens.map(token => token.replace(/^№/, '')).filter(Boolean);
  const documentQuery = { ...query, tokens };

  if (tokens.length === 0) {
    return [];
  }

  return entries.flatMap(({ displayTitle, document, title }) => {
    const number = document.displayNumber;

    if (!isSearchQueryMatched(documentQuery, [title])) {
      return [];
    }

    return [{
      isGtinMatched: false,
      option: {
        address: { kind: 'object', object: { id: document.id, type: 'document' } },
        detail: { kind: 'document' },
        detailMatches: [],
        groupId: 'documents',
        objectId: document.id,
        title: displayTitle,
        titleMatches: findMatchRanges(title, documentQuery),
      },
      rankText: tokens.includes(number.toLowerCase()) ? number : title,
    }];
  });
};
