import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  MutationObserver,
  onlineManager,
  type QueryClient,
  QueryObserver,
} from '@tanstack/react-query';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createIdempotencyKey } from '../idempotency/createIdempotencyKey';
import { createQueryClient } from './createQueryClient';

interface PaymentVariablesValue {
  amount: number;
  idempotencyKey: string;
}

const createUnavailableError = (): ConnectError => new ConnectError('down', Code.Unavailable);

const observeFailingQuery = (queryClient: QueryClient, error: Error): {
  queryFn: ReturnType<typeof vi.fn<() => Promise<never>>>;
  stop: () => void;
} => {
  const queryFn = vi.fn<() => Promise<never>>(() => Promise.reject(error));
  const observer = new QueryObserver(queryClient, { queryFn, queryKey: ['failing'] });
  const stop = observer.subscribe(() => undefined);

  return { queryFn, stop };
};

describe('createQueryClient', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = createQueryClient({ networkMode: 'always' });
  });

  afterEach(() => {
    queryClient.clear();
    vi.useRealTimers();
  });

  describe('network mode', () => {
    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('runs a query while the browser is offline in the always mode', async () => {
      onlineManager.setOnline(false);
      const queryFn = vi.fn<() => Promise<string>>(() => Promise.resolve('data'));
      const observer = new QueryObserver(queryClient, { queryFn, queryKey: ['offline'] });
      const stop = observer.subscribe(() => undefined);

      await vi.advanceTimersByTimeAsync(0);

      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(queryClient.getQueryState(['offline'])?.status).toBe('success');
      expect(queryClient.getQueryState(['offline'])?.fetchStatus).toBe('idle');

      stop();
    });

    it('runs a mutation while the browser is offline in the always mode', async () => {
      onlineManager.setOnline(false);
      const mutationFn = vi.fn<(variables: PaymentVariablesValue) => Promise<string>>(() => Promise.resolve('ok'));
      const observer = new MutationObserver(queryClient, { mutationFn });

      const result = observer.mutate({ amount: 1, idempotencyKey: createIdempotencyKey() });

      await vi.advanceTimersByTimeAsync(0);

      await expect(result).resolves.toBe('ok');
      expect(mutationFn).toHaveBeenCalledTimes(1);
      expect(observer.getCurrentResult().isPaused).toBe(false);
    });
  });

  describe('queries', () => {
    it('retries a retryable error three times with growing pauses', async () => {
      const { queryFn, stop } = observeFailingQuery(queryClient, createUnavailableError());

      await vi.advanceTimersByTimeAsync(0);
      expect(queryFn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(999);
      expect(queryFn).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(queryFn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1999);
      expect(queryFn).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(queryFn).toHaveBeenCalledTimes(3);

      await vi.advanceTimersByTimeAsync(3999);
      expect(queryFn).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(1);
      expect(queryFn).toHaveBeenCalledTimes(4);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(queryFn).toHaveBeenCalledTimes(4);
      expect(queryClient.getQueryState(['failing'])?.status).toBe('error');

      stop();
    });
  });

  describe('mutations', () => {
    const settle = (
      mutationFn: (variables: PaymentVariablesValue) => Promise<never>,
      variables: PaymentVariablesValue,
    ): Promise<unknown> => {
      const observer = new MutationObserver(queryClient, { mutationFn });

      return observer.mutate(variables).then(() => undefined, (error: unknown) => error);
    };

    it('retries a retryable error twice with the same variables and idempotency key', async () => {
      const mutationFn = vi.fn<(variables: PaymentVariablesValue) => Promise<never>>(
        () => Promise.reject(createUnavailableError()),
      );
      const variables: PaymentVariablesValue = { amount: 100, idempotencyKey: createIdempotencyKey() };

      const settled = settle(mutationFn, variables);

      await vi.advanceTimersByTimeAsync(0);
      expect(mutationFn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(999);
      expect(mutationFn).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(mutationFn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1999);
      expect(mutationFn).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(mutationFn).toHaveBeenCalledTimes(3);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(mutationFn).toHaveBeenCalledTimes(3);

      const error = await settled;

      expect(error).toBeInstanceOf(ConnectError);
      mutationFn.mock.calls.forEach(([received]) => {
        expect(received).toBe(variables);
        expect(received.idempotencyKey).toBe(variables.idempotencyKey);
      });
    });

    it('succeeds when a retry gets through and keeps the same key', async () => {
      const mutationFn = vi.fn<(variables: PaymentVariablesValue) => Promise<string>>()
        .mockRejectedValueOnce(createUnavailableError())
        .mockResolvedValueOnce('ok');
      const variables: PaymentVariablesValue = { amount: 5, idempotencyKey: createIdempotencyKey() };
      const observer = new MutationObserver(queryClient, { mutationFn });

      const result = observer.mutate(variables);

      await vi.advanceTimersByTimeAsync(1000);

      await expect(result).resolves.toBe('ok');
      expect(mutationFn.mock.calls.map(([received]) => received.idempotencyKey)).toEqual([
        variables.idempotencyKey,
        variables.idempotencyKey,
      ]);
    });
  });
});
