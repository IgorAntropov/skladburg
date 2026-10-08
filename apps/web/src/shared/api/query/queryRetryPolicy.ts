import { parseApiError } from '../errors/parseApiError';

export const QUERY_MAX_RETRIES = 3;
export const MUTATION_MAX_RETRIES = 2;
export const RETRY_BASE_DELAY_MS = 1000;
export const RETRY_MAX_DELAY_MS = 8000;

export const getRetryDelayMs = (failureCount: number): number => Math.min(
  RETRY_BASE_DELAY_MS * 2 ** failureCount,
  RETRY_MAX_DELAY_MS,
);

export const createRetryPredicate = (maxRetries: number): ((failureCount: number, error: unknown) => boolean) =>
  (failureCount, error) => {
    if (failureCount >= maxRetries) {
      return false;
    }

    return parseApiError(error).isRetryable;
  };
