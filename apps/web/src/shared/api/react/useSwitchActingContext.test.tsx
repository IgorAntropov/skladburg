import type { ListWarehousesResponse } from '@skladburg/contracts/organization/v1/organization';
import type {
  QueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import {
  createInProcessEngineConnection,
  DEMO_USER_HEADER,
  SeedOrganizationId,
  SeedPersonaId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import {
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
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

import type { ApiRuntimeValue } from '../runtime/apiRuntimeTypes';
import type { IEngineConnection } from '../transport/demo';
import type { SwitchActingContextResultValue } from './useSwitchActingContext';

import { createQueryClient } from '../query/createQueryClient';
import { createApiRuntime } from '../runtime/createApiRuntime';
import { ApiRuntimeProvider } from './ApiRuntimeProvider';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from './testing/createTestRuntime';
import { useActingContext } from './useActingContext';
import { useApiClient } from './useApiClient';
import { useSwitchActingContext } from './useSwitchActingContext';

const OTHER_USER_ID = 'f1000003-0000-4000-8000-000000000000';

interface RecordedRequestValue {
  organizationId: null | string;
  userId: null | string;
}

const closers: (() => Promise<void>)[] = [];

interface WarehousesWithSwitcherValue {
  switcher: SwitchActingContextResultValue;
  warehouses: UseQueryResult<ListWarehousesResponse>;
}

const useWarehousesWithSwitcher = (): WarehousesWithSwitcherValue => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const switcher = useSwitchActingContext();
  const warehouses = useQuery({
    queryFn: () => client.organization.listWarehouses({}),
    queryKey: ['warehouses', organizationId, userId],
  });

  return { switcher, warehouses };
};

const createWrapper = (
  runtime: ApiRuntimeValue,
  queryClient: QueryClient,
): (props: { children: ReactNode }) => ReactElement => {
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  return Wrapper;
};

const startEngineRuntime = async (
  personaId: string,
): Promise<{ recorded: RecordedRequestValue[]; runtime: ApiRuntimeValue }> => {
  const inProcess = createInProcessEngineConnection();
  closers.push(() => inProcess.close());
  const recorded: RecordedRequestValue[] = [];
  const connection: IEngineConnection = {
    ...inProcess.connection,
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      recorded.push({
        organizationId: headers.get(ACTING_ORGANIZATION_HEADER),
        userId: headers.get(DEMO_USER_HEADER),
      });

      return inProcess.connection.fetch(input, init);
    },
  };
  const runtime = await createApiRuntime({
    connection,
    defaultOrganizationId: SeedOrganizationId.BUYER_1,
    preferredPersonaId: personaId,
  });

  return { recorded, runtime };
};

const createDeferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe('useSwitchActingContext', () => {
  afterEach(async () => {
    cleanup();

    for (const close of closers.splice(0)) {
      await close();
    }
  });

  describe('with the demo engine', () => {
    it('shows the warehouses of the new persona instead of the cached ones of the previous one', async () => {
      const { runtime } = await startEngineRuntime(SeedPersonaId.FRESH_BUYER);
      const queryClient = createQueryClient({ networkMode: 'always' });
      const { result } = renderHook(useWarehousesWithSwitcher, { wrapper: createWrapper(runtime, queryClient) });

      await waitFor(() => {
        expect(result.current.warehouses.data?.warehouses).toHaveLength(3);
      });

      await act(async () => {
        await result.current.switcher.switchActingContext({
          organizationId: SeedOrganizationId.BUYER_1,
          userId: SeedUserId.STOREKEEPER_1,
        });
      });

      expect(queryClient.getQueryCache().find({
        queryKey: ['warehouses', SeedOrganizationId.BUYER_1, SeedUserId.ADMIN_1],
      })).toBeUndefined();

      await waitFor(() => {
        expect(result.current.warehouses.data?.warehouses).toHaveLength(1);
      });

      expect(runtime.actingContext.get()).toEqual({
        organizationId: SeedOrganizationId.BUYER_1,
        userId: SeedUserId.STOREKEEPER_1,
      });
      expect(queryClient.getQueryCache().findAll()).toHaveLength(1);

      runtime.close();
    });

    it('never sends a request with the organization of one persona and the user of another', async () => {
      const { recorded, runtime } = await startEngineRuntime(SeedPersonaId.FRESH_BUYER);
      const queryClient = createQueryClient({ networkMode: 'always' });
      const { result } = renderHook(useWarehousesWithSwitcher, { wrapper: createWrapper(runtime, queryClient) });
      const previous = { organizationId: SeedOrganizationId.BUYER_1, userId: SeedUserId.ADMIN_1 };
      const next = { organizationId: SeedOrganizationId.SELLER_1, userId: SeedUserId.ADMIN_2 };

      await act(async () => {
        await result.current.switcher.switchActingContext(next);
      });

      await waitFor(() => {
        expect(result.current.warehouses.data?.warehouses.length).toBeGreaterThan(0);
      });

      const isNext = (request: RecordedRequestValue): boolean => (
        request.organizationId === next.organizationId && request.userId === next.userId
      );
      const isPrevious = (request: RecordedRequestValue): boolean => (
        request.organizationId === previous.organizationId && request.userId === previous.userId
      );
      const firstNextIndex = recorded.findIndex(isNext);

      expect(firstNextIndex).toBeGreaterThanOrEqual(0);
      expect(recorded.every(request => isPrevious(request) || isNext(request))).toBe(true);
      expect(recorded.slice(firstNextIndex).every(isNext)).toBe(true);
      expect(result.current.warehouses.data?.warehouses.every(warehouse => (
        warehouse.tenantId === SeedOrganizationId.SELLER_1
      ))).toBe(true);

      runtime.close();
    });

    it('does not show the answer to a request started before the switch', async () => {
      const { runtime } = await startEngineRuntime(SeedPersonaId.FRESH_BUYER);
      const queryClient = createQueryClient({ networkMode: 'always' });
      const { result } = renderHook(useWarehousesWithSwitcher, { wrapper: createWrapper(runtime, queryClient) });

      expect(result.current.warehouses.isFetching).toBe(true);

      await act(async () => {
        await result.current.switcher.switchActingContext({
          organizationId: SeedOrganizationId.SELLER_1,
          userId: SeedUserId.ADMIN_2,
        });
      });

      await waitFor(() => {
        expect(result.current.warehouses.isSuccess).toBe(true);
      });

      expect(result.current.warehouses.data?.warehouses.every(warehouse => (
        warehouse.tenantId === SeedOrganizationId.SELLER_1
      ))).toBe(true);

      runtime.close();
    });

    it('does nothing when the chosen persona is the current one', async () => {
      const { recorded, runtime } = await startEngineRuntime(SeedPersonaId.FRESH_BUYER);
      const queryClient = createQueryClient({ networkMode: 'always' });
      const clear = vi.spyOn(queryClient, 'clear');
      const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');
      const { result } = renderHook(useWarehousesWithSwitcher, { wrapper: createWrapper(runtime, queryClient) });

      await waitFor(() => {
        expect(result.current.warehouses.data?.warehouses).toHaveLength(3);
      });

      const requestCount = recorded.length;
      const cachedData = result.current.warehouses.data;

      await act(async () => {
        await result.current.switcher.switchActingContext({
          organizationId: SeedOrganizationId.BUYER_1,
          userId: SeedUserId.ADMIN_1,
        });
      });

      expect(clear).not.toHaveBeenCalled();
      expect(cancelQueries).not.toHaveBeenCalled();
      expect(recorded).toHaveLength(requestCount);
      expect(result.current.warehouses.data).toBe(cachedData);
      expect(result.current.switcher.isSwitching).toBe(false);

      runtime.close();
    });
  });

  describe('with a test runtime', () => {
    it('cancels the queries, then sets the context, then clears the cache', async () => {
      const runtime = createTestRuntime();
      const queryClient = createQueryClient({ networkMode: 'always' });
      const calls: string[] = [];
      vi.spyOn(queryClient, 'cancelQueries').mockImplementation(() => {
        calls.push(`cancel:${runtime.actingContext.get().userId ?? 'none'}`);

        return Promise.resolve();
      });
      vi.spyOn(queryClient, 'clear').mockImplementation(() => {
        calls.push(`clear:${runtime.actingContext.get().userId ?? 'none'}`);
      });
      const { result } = renderHook(useSwitchActingContext, { wrapper: createWrapper(runtime, queryClient) });

      await act(async () => {
        await result.current.switchActingContext({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER_ID });
      });

      expect(calls).toEqual([`cancel:${TEST_USER_ID}`, `clear:${OTHER_USER_ID}`]);
    });

    it('is switching until the queries are cancelled and keeps the old context meanwhile', async () => {
      const runtime = createTestRuntime();
      const queryClient = createQueryClient({ networkMode: 'always' });
      const deferred = createDeferred();
      vi.spyOn(queryClient, 'cancelQueries').mockReturnValue(deferred.promise);
      const { result } = renderHook(useSwitchActingContext, { wrapper: createWrapper(runtime, queryClient) });

      expect(result.current.isSwitching).toBe(false);

      let switching: Promise<void> = Promise.resolve();

      act(() => {
        switching = result.current.switchActingContext({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER_ID });
      });

      expect(result.current.isSwitching).toBe(true);
      expect(runtime.actingContext.get().userId).toBe(TEST_USER_ID);

      await act(async () => {
        deferred.resolve();
        await switching;
      });

      expect(result.current.isSwitching).toBe(false);
      expect(runtime.actingContext.get().userId).toBe(OTHER_USER_ID);
    });

    it('ignores a second switch while the first one is running', async () => {
      const runtime = createTestRuntime();
      const queryClient = createQueryClient({ networkMode: 'always' });
      const deferred = createDeferred();
      const clear = vi.spyOn(queryClient, 'clear');
      vi.spyOn(queryClient, 'cancelQueries').mockReturnValue(deferred.promise);
      const { result } = renderHook(useSwitchActingContext, { wrapper: createWrapper(runtime, queryClient) });

      let first: Promise<void> = Promise.resolve();
      let second: Promise<void> = Promise.resolve();

      act(() => {
        first = result.current.switchActingContext({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER_ID });
        second = result.current.switchActingContext({ organizationId: 'org-2', userId: 'user-2' });
      });

      await act(async () => {
        deferred.resolve();
        await Promise.all([first, second]);
      });

      expect(runtime.actingContext.get()).toEqual({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER_ID });
      expect(clear).toHaveBeenCalledTimes(1);
    });

    it('leaves the context as it was and stops switching when cancelling fails', async () => {
      const runtime = createTestRuntime();
      const queryClient = createQueryClient({ networkMode: 'always' });
      vi.spyOn(queryClient, 'cancelQueries').mockRejectedValue(new Error('cancel failed'));
      const clear = vi.spyOn(queryClient, 'clear');
      const { result } = renderHook(useSwitchActingContext, { wrapper: createWrapper(runtime, queryClient) });

      await act(async () => {
        await expect(
          result.current.switchActingContext({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER_ID }),
        ).rejects.toThrow('cancel failed');
      });

      expect(result.current.isSwitching).toBe(false);
      expect(runtime.actingContext.get().userId).toBe(TEST_USER_ID);
      expect(clear).not.toHaveBeenCalled();
    });

    it('allows the next switch after the previous one is finished', async () => {
      const runtime = createTestRuntime();
      const queryClient = createQueryClient({ networkMode: 'always' });
      const { result } = renderHook(useSwitchActingContext, { wrapper: createWrapper(runtime, queryClient) });

      await act(async () => {
        await result.current.switchActingContext({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER_ID });
      });
      await act(async () => {
        await result.current.switchActingContext({ organizationId: 'org-2', userId: 'user-2' });
      });

      expect(runtime.actingContext.get()).toEqual({ organizationId: 'org-2', userId: 'user-2' });
    });
  });
});
