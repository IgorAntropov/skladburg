import type { OpenRequestValue } from './createRequestRecorder.ts';
import type { RequestValue } from './perfTypes.ts';

export interface ResourceTimingValue {
  encodedBodySize: number;
  endAt: number;
  startAt: number;
  transferSize: number;
  url: string;
}

export const mergeResourceTimings = (
  requests: readonly RequestValue[],
  openRequests: readonly OpenRequestValue[],
  resources: readonly ResourceTimingValue[],
): RequestValue[] => {
  const knownUrls = new Set(requests.map(request => request.url));
  const openStartByUrl = new Map(openRequests.map(openRequest => [openRequest.url, openRequest.startAt]));
  const missing: RequestValue[] = resources
    .filter(resource => !knownUrls.has(resource.url))
    .map(resource => ({
      bytes: resource.transferSize,
      endAt: resource.endAt,
      fromCache: resource.transferSize === 0 && resource.encodedBodySize > 0,
      startAt: openStartByUrl.get(resource.url) ?? resource.startAt,
      target: 'page',
      url: resource.url,
    }));

  return [...requests, ...missing].sort((first, second) => first.startAt - second.startAt);
};
