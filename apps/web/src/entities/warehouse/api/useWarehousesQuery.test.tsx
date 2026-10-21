import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  OrganizationService,
  type Warehouse,
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

describe('useWarehousesQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not request warehouses without an acting organization', () => {
    const listWarehouses = vi.fn((): { warehouses: Warehouse[] } => ({ warehouses: [] }));
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

  it('stores the list under the organization key and declares the organization channel', async () => {
    const listWarehouses = vi.fn((): { warehouses: Warehouse[] } => ({
      warehouses: [
        create(WarehouseSchema, { id: 'f5000001-0000-4000-8000-000000000000', name: 'Склад «Север»' }),
        create(WarehouseSchema, { id: 'f5000002-0000-4000-8000-000000000000', name: 'Склад «Юг»' }),
      ],
    }));
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
    expect(query?.state.data).toHaveLength(2);
  });
});
