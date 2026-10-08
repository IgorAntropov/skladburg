import type { QueryClient } from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  AccessService,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
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

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';

import { sessionKeys } from './sessionKeys';
import { useSessionQuery } from './useSessionQuery';

const OTHER_USER_ID = 'f1000003-0000-4000-8000-000000000000';

interface RenderedSessionValue {
  queryClient: QueryClient;
  result: { current: ReturnType<typeof useSessionQuery> };
}

const renderSessionHook = (runtime: ApiRuntimeValue): RenderedSessionValue => {
  const queryClient = createQueryClient({ networkMode: 'always' });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  const { result } = renderHook(useSessionQuery, { wrapper: Wrapper });

  return { queryClient, result };
};

describe('useSessionQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('requests the session and returns it', async () => {
    const getSession = vi.fn(() => create(GetSessionResponseSchema, { actingOrganizationId: TEST_ORGANIZATION_ID }));
    const runtime = createTestRuntime({ routes: router => router.service(AccessService, { getSession }) });

    const { result } = renderSessionHook(runtime);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.actingOrganizationId).toBe(TEST_ORGANIZATION_ID);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('stores the data under the key with organization and user and declares both channels', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(AccessService, { getSession: () => create(GetSessionResponseSchema) }),
    });

    const { queryClient, result } = renderSessionHook(runtime);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({
      exact: true,
      queryKey: sessionKeys.current(TEST_ORGANIZATION_ID, TEST_USER_ID),
    });

    expect(query?.state.data).toBe(result.current.data);
    expect(query?.meta).toEqual({ channels: [`org:${TEST_ORGANIZATION_ID}`, `user:${TEST_USER_ID}`] });
  });

  it('sends the acting organization header', async () => {
    const headers: (null | string)[] = [];
    const runtime = createTestRuntime({
      routes: router => router.service(AccessService, {
        getSession: (_request, context) => {
          headers.push(context.requestHeader.get(ACTING_ORGANIZATION_HEADER));

          return create(GetSessionResponseSchema);
        },
      }),
    });

    const { result } = renderSessionHook(runtime);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(headers).toEqual([TEST_ORGANIZATION_ID]);
  });

  it('does not request anything while there is no acting organization', async () => {
    const getSession = vi.fn(() => create(GetSessionResponseSchema));
    const runtime = createTestRuntime({ routes: router => router.service(AccessService, { getSession }) });

    runtime.actingContext.set({ organizationId: undefined, userId: TEST_USER_ID });

    const { queryClient, result } = renderSessionHook(runtime);

    await Promise.resolve();

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isPending).toBe(true);
    expect(getSession).not.toHaveBeenCalled();

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: sessionKeys.current('none', TEST_USER_ID) });

    expect(query?.meta).toEqual({ channels: [`user:${TEST_USER_ID}`] });
  });

  it('does not request anything while there is no acting user', async () => {
    const getSession = vi.fn(() => create(GetSessionResponseSchema));
    const runtime = createTestRuntime({ routes: router => router.service(AccessService, { getSession }) });

    runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: undefined });

    const { queryClient, result } = renderSessionHook(runtime);

    await Promise.resolve();

    expect(result.current.fetchStatus).toBe('idle');
    expect(getSession).not.toHaveBeenCalled();

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: sessionKeys.current(TEST_ORGANIZATION_ID, 'none') });

    expect(query?.meta).toEqual({ channels: [`org:${TEST_ORGANIZATION_ID}`] });
  });

  it('requests the session again when the acting user changes', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(AccessService, {
        getSession: (_request, context) => create(GetSessionResponseSchema, {
          actingOrganizationId: context.requestHeader.get(ACTING_ORGANIZATION_HEADER) ?? '',
        }),
      }),
    });

    const { queryClient, result } = renderSessionHook(runtime);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER_ID });
    });

    await waitFor(() => {
      expect(queryClient.getQueryCache().find({
        exact: true,
        queryKey: sessionKeys.current(TEST_ORGANIZATION_ID, OTHER_USER_ID),
      })?.state.status).toBe('success');
    });
  });
});
