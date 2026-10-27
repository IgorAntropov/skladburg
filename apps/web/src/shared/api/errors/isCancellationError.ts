import {
  Code,
  ConnectError,
} from '@connectrpc/connect';

export const isCancellationError = (error: unknown): boolean => {
  if (error instanceof ConnectError) {
    return error.code === Code.Canceled;
  }

  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
};
