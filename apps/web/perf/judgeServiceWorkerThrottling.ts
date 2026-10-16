import type { PreparationOutcomeValue } from './createPreparationTracker.ts';
import type {
  NetworkConditionsValue,
  RequestValue,
  ServiceWorkerThrottlingValue,
} from './perfTypes.ts';

import { checkServiceWorkerThrottling } from './checkServiceWorkerThrottling.ts';

export interface JudgeServiceWorkerInputValue {
  network: NetworkConditionsValue;
  outcomes: readonly PreparationOutcomeValue[];
  requests: readonly RequestValue[];
}

export const judgeServiceWorkerThrottling = ({
  network,
  outcomes,
  requests,
}: JudgeServiceWorkerInputValue): ServiceWorkerThrottlingValue => {
  if (outcomes.length === 0) {
    return { isThrottled: null, note: 'absent' };
  }

  if (outcomes.includes('refused')) {
    return { isThrottled: false, note: 'refused' };
  }

  if (checkServiceWorkerThrottling(requests, network) === 'violated') {
    return { isThrottled: false, note: 'loaded-before-emulation' };
  }

  if (outcomes.includes('pending')) {
    return { isThrottled: null, note: 'not-finished' };
  }

  return { isThrottled: true };
};
