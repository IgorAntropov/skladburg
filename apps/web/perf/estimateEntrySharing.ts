import type { RequestValue } from './perfTypes.ts';

import { readPathname } from './readUrlPath.ts';

export interface EntrySharingValue {
  bytes: number;
  delayMs: number;
}

export interface EstimateEntrySharingInputValue {
  downloadBytesPerSecond: number;
  entry: RequestValue;
  latencyMs: number;
  requests: readonly RequestValue[];
}

const MILLISECONDS_PER_SECOND = 1000;
const EXCLUDED_PATH_SUFFIXES = ['.css', '.html', '/'];

const isSharingChannel = (request: RequestValue, entry: RequestValue, latencyMs: number): boolean => {
  const isOverlapping = request.startAt + latencyMs < entry.endAt && request.endAt > entry.startAt;
  const pathname = readPathname(request.url);
  const isExcludedKind = EXCLUDED_PATH_SUFFIXES.some(suffix => pathname.endsWith(suffix));
  const isDownloaded = !request.fromCache && request.isRevalidated !== true && request.bytes > 0;

  return request.target !== 'service-worker'
    && request.url !== entry.url
    && isOverlapping
    && !isExcludedKind
    && isDownloaded;
};

export const estimateEntrySharing = ({
  downloadBytesPerSecond,
  entry,
  latencyMs,
  requests,
}: EstimateEntrySharingInputValue): EntrySharingValue => {
  const bytes = requests
    .filter(request => isSharingChannel(request, entry, latencyMs))
    .reduce((total, request) => total + Math.min(request.bytes, entry.bytes), 0);

  return { bytes, delayMs: bytes / downloadBytesPerSecond * MILLISECONDS_PER_SECOND };
};
