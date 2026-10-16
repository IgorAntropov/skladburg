import type {
  NetworkConditionsValue,
  RequestValue,
  WorkerThrottlingValue,
} from './perfTypes.ts';

import { checkWorkerThrottling } from './checkWorkerThrottling.ts';

export const judgeWorkerThrottling = (
  requests: readonly RequestValue[],
  network: NetworkConditionsValue,
): WorkerThrottlingValue => {
  const verdict = checkWorkerThrottling(requests, network);

  if (verdict === 'unverifiable') {
    return { isThrottled: null, note: 'no-network-load' };
  }

  return { isThrottled: verdict === 'verified' };
};
