import type { QueryKey } from '@tanstack/react-query';

import { useMutation } from '@tanstack/react-query';
import {
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';

import type {
  CommandOptionsValue,
  CommandValue,
} from './commandTypes';

import { isCancellationError } from '../errors/isCancellationError';
import { parseApiError } from '../errors/parseApiError';
import { createIdempotencyKey } from '../idempotency/createIdempotencyKey';
import { ApiRuntimeContext } from '../react/ApiRuntimeContext';

export const useCommand = <TResult>(options: CommandOptionsValue<TResult>): CommandValue => {
  const {
    execute,
    method,
    mutationKey,
    onSuccess,
  } = options;
  const errorJournal = useContext(ApiRuntimeContext)?.errorJournal;
  const journalMethod = method === undefined ? 'unknown' : `${method.parent.typeName}/${method.name}`;
  const idempotencyKeyRef = useRef<string | undefined>(undefined);
  const isRunningRef = useRef(false);

  const resolvedMutationKey = useMemo((): QueryKey | undefined => {
    if (mutationKey !== undefined) {
      return mutationKey;
    }

    return method === undefined ? undefined : ['command', method.parent.typeName, method.name];
  }, [method, mutationKey]);

  const mutation = useMutation<TResult, Error, string>({
    mutationFn: (idempotencyKey: string): Promise<TResult> => execute(idempotencyKey),
    mutationKey: resolvedMutationKey,
    onError: (error: Error): void => {
      const parsedError = parseApiError(error);

      if (!parsedError.isRetryable) {
        idempotencyKeyRef.current = undefined;
      }

      if (!isCancellationError(error)) {
        errorJournal?.record({
          code: parsedError.code,
          method: journalMethod,
          occurredAt: Date.now(),
          params: parsedError.params,
          traceId: parsedError.traceId,
        });
      }
    },
    onSettled: (): void => {
      isRunningRef.current = false;
    },
    onSuccess: (result: TResult): void => {
      idempotencyKeyRef.current = undefined;
      onSuccess?.(result);
    },
    retry: false,
  });
  const {
    error,
    isError,
    isPending,
    mutate,
    reset: resetMutation,
    submittedAt,
  } = mutation;

  const apiError = useMemo(() => (error === null ? undefined : parseApiError(error)), [error]);
  const failedAt = isError ? submittedAt : 0;
  const methodName = method?.name;

  const run = useCallback((): void => {
    if (isRunningRef.current) {
      return;
    }

    const isRetry = idempotencyKeyRef.current !== undefined;
    const idempotencyKey = idempotencyKeyRef.current ?? createIdempotencyKey();

    console.log('> useCommand -> run:', { isRetry, method: methodName });

    isRunningRef.current = true;
    idempotencyKeyRef.current = idempotencyKey;
    mutate(idempotencyKey);
  }, [methodName, mutate]);

  const reset = useCallback((): void => {
    if (isRunningRef.current) {
      return;
    }

    idempotencyKeyRef.current = undefined;
    resetMutation();
  }, [resetMutation]);

  return {
    apiError,
    error,
    failedAt,
    isPending,
    method,
    reset,
    run,
  };
};
