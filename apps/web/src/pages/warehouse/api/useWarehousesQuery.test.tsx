import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  OrganizationService,
  type Warehouse,
} from '@skladburg/contracts/organization/v1/organization';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  cleanup,
  renderHook,
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
import { createTestRuntime } from '@/shared/api/index.testing';

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
});
