import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  ClockService,
  GetWorldClockResponseSchema,
} from '@skladburg/contracts/clock/v1/clock';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ApiRuntimeValue } from '@/shared/api';

import { ApiRuntimeProvider } from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';

import {
  createUnavailableFailure,
  createWorldClockRoutes,
  WORLD_START_MS,
} from '../lib/testing/worldClockHarness';
import { useWorldClockQuery } from './useWorldClockQuery';
import { worldClockKeys } from './worldClockKeys';

interface RenderedClockQueryValue {
  queryClient: QueryClient;
  result: { current: ReturnType<typeof useWorldClockQuery> };
}

const createQueryClient = (): QueryClient => new QueryClient({ defaultOptions: { queries: { networkMode: 'always', retry: false } } });

const createWrapper = (runtime: ApiRuntimeValue, queryClient: QueryClient): (props: { children: ReactNode }) => ReactElement => {
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  return Wrapper;
};

const renderClockQuery = (runtime: ApiRuntimeValue): RenderedClockQueryValue => {
  const queryClient = createQueryClient();
  const { result } = renderHook(useWorldClockQuery, { wrapper: createWrapper(runtime, queryClient) });

  return { queryClient, result };
};

describe('useWorldClockQuery', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('returns the world time in milliseconds and the scale of the answer', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const { routes } = createWorldClockRoutes({ timeScale: 60 });

    const { result } = renderClockQuery(createTestRuntime({ routes }));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.snapshot).toEqual({ timeScale: 60, worldTimeMs: WORLD_START_MS });
  });

  it('stores the moment of receiving by the monotonic clock after the answer was built', async () => {
    let nowMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      nowMs += 1;

      return nowMs;
    });
    const { routes } = createWorldClockRoutes();

    const { result } = renderClockQuery(createTestRuntime({ routes }));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const answerBuiltAtMs = (result.current.data?.snapshot.worldTimeMs ?? 0) - WORLD_START_MS;

    expect(result.current.data?.receivedAtMs).toBeGreaterThan(answerBuiltAtMs);
  });

  it('uses the key without organization and user', async () => {
    const { routes } = createWorldClockRoutes();

    const { queryClient, result } = renderClockQuery(createTestRuntime({ routes }));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(queryClient.getQueryData(worldClockKeys.current())).toBe(result.current.data);
  });

  it('keeps the answer fresh for a new reader for five minutes and asks again after them', async () => {
    const { getCallCount, routes } = createWorldClockRoutes();
    const wrapper = createWrapper(createTestRuntime({ routes }), createQueryClient());

    const first = renderHook(useWorldClockQuery, { wrapper });

    await waitFor(() => {
      expect(first.result.current.isSuccess).toBe(true);
    });

    const answeredAtMs = first.result.current.dataUpdatedAt;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(answeredAtMs + 299_999);
    const freshReader = renderHook(useWorldClockQuery, { wrapper });

    expect(freshReader.result.current.isFetching).toBe(false);

    dateNow.mockReturnValue(answeredAtMs + 300_000);
    const lateReader = renderHook(useWorldClockQuery, { wrapper });

    expect(lateReader.result.current.isFetching).toBe(true);

    await waitFor(() => {
      expect(getCallCount()).toBe(2);
    });
  });

  it('asks only once for several readers', async () => {
    const { getCallCount, routes } = createWorldClockRoutes();
    const runtime = createTestRuntime({ routes });
    const wrapper = createWrapper(runtime, createQueryClient());

    const first = renderHook(useWorldClockQuery, { wrapper });
    const second = renderHook(useWorldClockQuery, { wrapper });

    await waitFor(() => {
      expect(first.result.current.isSuccess && second.result.current.isSuccess).toBe(true);
    });

    expect(getCallCount()).toBe(1);
  });

  it('fails with the error of the server', async () => {
    const { routes } = createWorldClockRoutes({ failure: createUnavailableFailure() });

    const { result } = renderClockQuery(createTestRuntime({ routes }));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });

  it('fails when the answer has no world time', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(ClockService, {
        getWorldClock: () => create(GetWorldClockResponseSchema, { timeScale: 1 }),
      }),
    });

    const { result } = renderClockQuery(runtime);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('world_time_missing');
  });
});
