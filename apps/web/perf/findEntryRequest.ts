import type { RequestValue } from './perfTypes.ts';

import { readPathname } from './readUrlPath.ts';

const ENTRY_SCRIPT_PATTERN = /\/assets\/index-[\w-]+\.js$/;

const isEntryCandidate = (request: RequestValue): boolean => request.target === 'page' && request.isRevalidated !== true;

const findEarliest = (requests: readonly RequestValue[]): RequestValue | undefined => (
  [...requests].sort((first, second) => first.startAt - second.startAt)[0]
);

export const findEntryRequest = (
  requests: readonly RequestValue[],
  entryScriptUrl: null | string | undefined,
): RequestValue | undefined => {
  const candidates = requests.filter(isEntryCandidate);
  const byUrl = entryScriptUrl === null || entryScriptUrl === undefined
    ? undefined
    : findEarliest(candidates.filter(request => request.url === entryScriptUrl));

  return byUrl ?? findEarliest(candidates.filter(request => ENTRY_SCRIPT_PATTERN.test(readPathname(request.url))));
};

export const measureFromEntry = (at: null | number, entry: RequestValue | undefined): null | number => (
  at === null || entry === undefined ? null : at - entry.startAt
);
