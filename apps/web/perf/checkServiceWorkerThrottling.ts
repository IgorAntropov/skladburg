import type { ThrottlingVerdictValue } from './checkWorkerThrottling.ts';
import type {
  NetworkConditionsValue,
  RequestValue,
} from './perfTypes.ts';

import { THROTTLING_TOLERANCE } from './checkWorkerThrottling.ts';

export const checkServiceWorkerThrottling = (
  requests: readonly RequestValue[],
  network: NetworkConditionsValue,
): ThrottlingVerdictValue => {
  const downloaded = requests.filter(request => request.target === 'service-worker' && !request.fromCache && request.bytes > 0);

  if (downloaded.length === 0) {
    return 'unverifiable';
  }

  const minimumDurationMs = network.latencyMs * THROTTLING_TOLERANCE;

  return downloaded.some(request => request.endAt - request.startAt < minimumDurationMs) ? 'violated' : 'verified';
};
