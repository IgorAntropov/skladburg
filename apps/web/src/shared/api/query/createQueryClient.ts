import { QueryClient } from '@tanstack/react-query';

import {
  createRetryPredicate,
  getRetryDelayMs,
  MUTATION_MAX_RETRIES,
  QUERY_MAX_RETRIES,
} from './queryRetryPolicy';

export const createQueryClient = (): QueryClient => new QueryClient({
  defaultOptions: {
    mutations: {
      retry: createRetryPredicate(MUTATION_MAX_RETRIES),
      retryDelay: getRetryDelayMs,
    },
    queries: {
      refetchOnWindowFocus: false,
      retry: createRetryPredicate(QUERY_MAX_RETRIES),
      retryDelay: getRetryDelayMs,
    },
  },
});
