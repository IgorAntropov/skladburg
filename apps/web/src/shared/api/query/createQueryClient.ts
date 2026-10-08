import { QueryClient } from '@tanstack/react-query';

import type { QueryNetworkModeValue } from '../runtime/apiRuntimeTypes';

import {
  createRetryPredicate,
  getRetryDelayMs,
  MUTATION_MAX_RETRIES,
  QUERY_MAX_RETRIES,
} from './queryRetryPolicy';

export interface CreateQueryClientOptionsValue {
  networkMode: QueryNetworkModeValue;
}

export const createQueryClient = (options: CreateQueryClientOptionsValue): QueryClient => new QueryClient({
  defaultOptions: {
    mutations: {
      networkMode: options.networkMode,
      retry: createRetryPredicate(MUTATION_MAX_RETRIES),
      retryDelay: getRetryDelayMs,
    },
    queries: {
      networkMode: options.networkMode,
      refetchOnWindowFocus: false,
      retry: createRetryPredicate(QUERY_MAX_RETRIES),
      retryDelay: getRetryDelayMs,
    },
  },
});
