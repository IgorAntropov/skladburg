import type {
  NetworkConditionsValue,
  RequestValue,
} from './perfTypes.ts';

import { readPathname } from './readUrlPath.ts';

export type ThrottlingVerdictValue = 'unverifiable' | 'verified' | 'violated';

export const ENGINE_CORE_URL_PATTERN = /\/engine-[\w-]+\.js$/;

const MILLISECONDS_PER_SECOND = 1000;
export const THROTTLING_TOLERANCE = 0.8;

export const checkWorkerThrottling = (
  requests: readonly RequestValue[],
  network: NetworkConditionsValue,
  coreUrlPattern: RegExp = ENGINE_CORE_URL_PATTERN,
): ThrottlingVerdictValue => {
  const coreRequest = requests.find(request => (
    request.target === 'worker' && coreUrlPattern.test(readPathname(request.url)) && !request.fromCache && request.bytes > 0
  ));

  if (coreRequest === undefined) {
    return 'unverifiable';
  }

  const transferMs = coreRequest.bytes / network.downloadBytesPerSecond * MILLISECONDS_PER_SECOND;
  const minimumDurationMs = (network.latencyMs + transferMs) * THROTTLING_TOLERANCE;

  return coreRequest.endAt - coreRequest.startAt >= minimumDurationMs ? 'verified' : 'violated';
};

