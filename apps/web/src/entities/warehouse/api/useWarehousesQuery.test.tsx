import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  type ListWarehousesRequest,
  type ListWarehousesResponse,
  ListWarehousesResponseSchema,
  OrganizationService,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';
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

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';

import { useWarehousesQuery } from './useWarehousesQuery';
import { warehouseKeys } from './warehouseKeys';

const createWarehouseResponse = (
  ids: readonly string[],
  nextPageToken: string,
): ListWarehousesResponse => create(ListWarehousesResponseSchema, {
  page: { nextPageToken },
  warehouses: ids.map(id => create(WarehouseSchema, { id, name: id })),
});

describe('useWarehousesQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not request warehouses without an acting organization', () => {
    const listWarehouses = vi.fn((): ListWarehousesResponse => createWarehouseResponse([], ''));
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationService, { listWarehouses }),
    });
    runtime.actingContext.set({ organizationId: undefined, userId: undefined });
    const queryClient: QueryClient = createQueryClient({ networkMode: 'always' });

    const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiRuntimeProvider>
    );

    const { result } = renderHook(useWarehousesQuery, { wrapper: Wrapper });
    const query = queryClient.getQueryCache().find({ exact: true, queryKey: warehouseKeys.list('none') });

    expect(listWarehouses).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(query?.meta).toEqual({ channels: [] });
  });

  it('stores all pages under the organization key and declares the organization channel', async () => {
    const listWarehouses = vi.fn((request: ListWarehousesRequest): ListWarehousesResponse => (
      request.page?.pageToken === 'second'
        ? createWarehouseResponse(['warehouse-3'], '')
        : createWarehouseResponse(['warehouse-1', 'warehouse-2'], 'second')
    ));
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationService, { listWarehouses }),
    });
    const queryClient: QueryClient = createQueryClient({ networkMode: 'always' });

    const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiRuntimeProvider>
    );

    const { result } = renderHook(useWarehousesQuery, { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: warehouseKeys.list(TEST_ORGANIZATION_ID) });

    expect(query?.meta).toEqual({ channels: [`org:${TEST_ORGANIZATION_ID}`] });
    expect(result.current.data?.map(warehouse => warehouse.id)).toEqual(['warehouse-1', 'warehouse-2', 'warehouse-3']);
    expect(listWarehouses).toHaveBeenCalledTimes(2);
    expect(listWarehouses.mock.calls[0]?.[0].page?.pageSize).toBe(200);
  });
});
