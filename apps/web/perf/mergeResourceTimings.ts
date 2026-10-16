import type { OpenRequestValue } from './createRequestRecorder.ts';
import type { RequestValue } from './perfTypes.ts';

export interface ResourceTimingValue {
  encodedBodySize: number;
  endAt: number;
  startAt: number;
  transferSize: number;
  url: string;
}

interface MatchCandidateValue {
  distance: number;
  resourceIndex: number;
  sourceIndex: number;
}

interface StartValue {
  startAt: number;
  url: string;
}

const START_MATCH_TOLERANCE_MS = 250;

export const isRevalidation = (resource: ResourceTimingValue): boolean => (
  resource.transferSize > 0 && resource.transferSize < resource.encodedBodySize
);

const matchByNearestStart = (
  resources: readonly ResourceTimingValue[],
  sources: readonly StartValue[],
  toleranceMs: number,
  isResourceFree: (resourceIndex: number) => boolean,
): Map<number, number> => {
  const candidates: MatchCandidateValue[] = [];

  resources.forEach((resource, resourceIndex) => {
    sources.forEach((source, sourceIndex) => {
      const distance = Math.abs(source.startAt - resource.startAt);

      if (isResourceFree(resourceIndex) && source.url === resource.url && distance <= toleranceMs) {
        candidates.push({ distance, resourceIndex, sourceIndex });
      }
    });
  });

  const sourceByResource = new Map<number, number>();
  const takenSources = new Set<number>();

  for (const { resourceIndex, sourceIndex } of candidates.sort((first, second) => first.distance - second.distance)) {
    if (!sourceByResource.has(resourceIndex) && !takenSources.has(sourceIndex)) {
      sourceByResource.set(resourceIndex, sourceIndex);
      takenSources.add(sourceIndex);
    }
  }

  return sourceByResource;
};

const createRequestFromResource = (resource: ResourceTimingValue, startAt: number): RequestValue => ({
  bytes: resource.transferSize,
  endAt: resource.endAt,
  fromCache: resource.transferSize === 0 && resource.encodedBodySize > 0,
  ...isRevalidation(resource) ? { isRevalidated: true } : {},
  startAt,
  target: 'page',
  url: resource.url,
});

export const mergeResourceTimings = (
  requests: readonly RequestValue[],
  openRequests: readonly OpenRequestValue[],
  resources: readonly ResourceTimingValue[],
): RequestValue[] => {
  const requestByResource = matchByNearestStart(resources, requests, START_MATCH_TOLERANCE_MS, () => true);
  const openRequestByResource = matchByNearestStart(
    resources,
    openRequests,
    Number.POSITIVE_INFINITY,
    resourceIndex => !requestByResource.has(resourceIndex),
  );
  const revalidatedRequestIndexes = new Set<number>();
  const added: RequestValue[] = [];

  resources.forEach((resource, resourceIndex) => {
    const requestIndex = requestByResource.get(resourceIndex);

    if (requestIndex === undefined) {
      const openIndex = openRequestByResource.get(resourceIndex);
      const openRequest = openIndex === undefined ? undefined : openRequests[openIndex];

      added.push(createRequestFromResource(resource, openRequest?.startAt ?? resource.startAt));
    }
    else if (isRevalidation(resource)) {
      revalidatedRequestIndexes.add(requestIndex);
    }
  });

  const known = requests.map((request, index) => (
    revalidatedRequestIndexes.has(index) ? { ...request, isRevalidated: true } : request
  ));

  return [...known, ...added].sort((first, second) => first.startAt - second.startAt);
};
