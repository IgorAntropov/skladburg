import type { ServiceImpl } from '@connectrpc/connect';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  type GetTripResponse,
  GetTripResponseSchema,
  LogisticsService,
} from '@skladburg/contracts/logistics/v1/logistics';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import {
  focusManager,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';

import { useTrip } from './useTransportQueries';

const TRIP_ID = '10000000-0000-4000-8000-000000000002';
const OTHER_ORGANIZATION_ID = '20000000-0000-4000-8000-000000000002';

const createHarness = (getTrip: ServiceImpl<typeof LogisticsService>['getTrip']): {
  queryClient: ReturnType<typeof createQueryClient>;
  runtime: ReturnType<typeof createTestRuntime>;
  Wrapper: (props: { children: ReactNode }) => ReactElement;
} => {
  const runtime = createTestRuntime({
    routes: router => router.service(LogisticsService, { getTrip }),
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );
  return { queryClient, runtime, Wrapper };
};

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

it('does not carry the previous payer projection into a different acting organization', async () => {
  const { queryClient, runtime, Wrapper } = createHarness(({ tripId }, context): GetTripResponse => {
    const isPayer = context.requestHeader.get(ACTING_ORGANIZATION_HEADER) === TEST_ORGANIZATION_ID;
    return create(GetTripResponseSchema, {
      trip: { id: tripId, transportOrder: isPayer ? { amount: { amountMinor: 50_000n, currencyCode: 'RUB' } } : undefined },
    });
  });
  const { result } = renderHook(() => useTrip(TRIP_ID, true), { wrapper: Wrapper });

  await waitFor(() => {
    expect(result.current.data?.transportOrder?.amount?.amountMinor).toBe(50_000n);
  });
  act(() => {
    runtime.actingContext.set({ organizationId: OTHER_ORGANIZATION_ID, userId: TEST_USER_ID });
  });
  expect(result.current.data?.transportOrder).toBeUndefined();
  await waitFor(() => {
    expect(result.current.data?.id).toBe(TRIP_ID);
  });

  const query = queryClient.getQueryCache().find({ queryKey: ['transport', OTHER_ORGANIZATION_ID, TEST_USER_ID, 'trip', TRIP_ID] });
  expect(query?.meta).toEqual({ channels: [`org:${OTHER_ORGANIZATION_ID}`], eventCases: ['transportRequestChanged'] });
  expect(result.current.data?.transportOrder).toBeUndefined();
});

it('refreshes a live sample in the foreground and stops after arrival', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  focusManager.setFocused(true);
  const arrivedAt = timestampFromMs(1_200_000);
  let sample = 20;
  const getTrip = vi.fn((): GetTripResponse => create(GetTripResponseSchema, {
    trip: {
      arrivedAt: sample === 22 ? arrivedAt : undefined,
      bodyTemperature: { deciCelsius: sample++ },
      id: TRIP_ID,
    },
  }));
  const { Wrapper } = createHarness(getTrip);
  const { result } = renderHook(() => useTrip(TRIP_ID, true, true), { wrapper: Wrapper });

  await vi.waitFor(() => {
    expect(result.current.data?.bodyTemperature?.deciCelsius).toBe(20);
  });
  await act(async () => vi.advanceTimersByTimeAsync(15_000));
  await vi.waitFor(() => {
    expect(result.current.data?.bodyTemperature?.deciCelsius).toBe(21);
  });

  focusManager.setFocused(false);
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(getTrip).toHaveBeenCalledTimes(2);

  focusManager.setFocused(true);
  await act(async () => vi.advanceTimersByTimeAsync(15_000));
  await vi.waitFor(() => {
    expect(result.current.data?.arrivedAt).toEqual(arrivedAt);
  });
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(getTrip).toHaveBeenCalledTimes(3);
});
