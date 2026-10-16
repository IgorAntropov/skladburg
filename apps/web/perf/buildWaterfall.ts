import type { RequestValue } from './perfTypes.ts';

import { readPathname } from './readUrlPath.ts';

export interface WaterfallRowValue {
  label: string;
  request: RequestValue | undefined;
}

interface KeyFileRuleValue {
  label: string;
  ordinal?: number;
  pattern: RegExp;
}

const KEY_FILE_RULES: readonly KeyFileRuleValue[] = [
  { label: 'index', pattern: /\/assets\/index-[\w-]+\.js$/ },
  { label: 'mountApp', pattern: /\/assets\/mountApp-[\w-]+\.js$/ },
  { label: 'apiErrorFromDetail', pattern: /\/assets\/apiErrorFromDetail-[\w-]+\.js$/ },
  { label: 'demo', pattern: /\/assets\/demo-[\w-]+\.js$/ },
  { label: 'worker wrapper', ordinal: 0, pattern: /\/assets\/worker-[\w-]+\.js$/ },
  { label: 'worker script', ordinal: 1, pattern: /\/assets\/worker-[\w-]+\.js$/ },
  { label: 'engine core', pattern: /\/assets\/engine-[\w-]+\.js$/ },
  { label: 'network section', pattern: /\/assets\/network-[\w-]+\.js$/ },
  { label: 'css', pattern: /\/assets\/index-[\w-]+\.css$/ },
  { label: 'font', ordinal: 0, pattern: /\.woff2$/ },
  { label: 'font (second)', ordinal: 1, pattern: /\.woff2$/ },
];

const findFirstRequests = (requests: readonly RequestValue[], pattern: RegExp): RequestValue[] => {
  const firstByUrl = new Map<string, RequestValue>();

  for (const request of requests) {
    if (!firstByUrl.has(request.url) && pattern.test(readPathname(request.url))) {
      firstByUrl.set(request.url, request);
    }
  }

  return [...firstByUrl.values()].sort((first, second) => first.startAt - second.startAt);
};

export const buildWaterfall = (requests: readonly RequestValue[]): WaterfallRowValue[] => (
  KEY_FILE_RULES.map(rule => ({
    label: rule.label,
    request: findFirstRequests(requests, rule.pattern)[rule.ordinal ?? 0],
  }))
);

