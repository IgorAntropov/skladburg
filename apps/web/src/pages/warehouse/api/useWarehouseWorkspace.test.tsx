import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  AccessService,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import { WarehouseSchema } from '@skladburg/contracts/organization/v1/organization';
import {
  inventoryChannel,
  tasksChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  ListPickingTasksResponseSchema,
  WarehousePickingService,
} from '@skladburg/contracts/wms/v1/picking';
import {
  ListReceivingTasksResponseSchema,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  ListStockBalancesResponseSchema,
  ListStockMovementsResponseSchema,
  WarehouseStockService,
} from '@skladburg/contracts/wms/v1/stock';
import {
  GetWarehouseTopologyResponseSchema,
  WarehouseTopologyService,
} from '@skladburg/contracts/wms/v1/topology';
import { QueryClientProvider } from '@tanstack/react-query';
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

import { useWarehouseObjectLookup } from './useWarehouseObjectLookup';
import { useWarehouseWorkspace } from './useWarehouseWorkspace';

const WAREHOUSE = '80000000-0000-4000-8000-000000000001';
const OTHER_WAREHOUSE = '80000000-0000-4000-8000-000000000002';
const OTHER_USER = '80000000-0000-4000-8000-000000000003';

afterEach(cleanup);

it('loads only permitted warehouse views and retains each page and event scope', async () => {
  const getWarehouseTopology = vi.fn(() => create(GetWarehouseTopologyResponseSchema));
  const listPickingTasks = vi.fn(() => create(ListPickingTasksResponseSchema));
  const listReceivingTasks = vi.fn(() => create(ListReceivingTasksResponseSchema));
  const listStockMovements = vi.fn(() => create(ListStockMovementsResponseSchema));
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(AccessService, {
        getSession: () => create(GetSessionResponseSchema, {
          permissions: [
            { permission: 'inventory_view', warehouseIds: [WAREHOUSE] },
            { permission: 'warehouse_view', warehouseIds: [WAREHOUSE] },
            { permission: 'task_view', warehouseIds: [OTHER_WAREHOUSE] },
          ],
        }),
      });
      router.service(WarehouseTopologyService, { getWarehouseTopology });
      router.service(WarehousePickingService, { listPickingTasks });
      router.service(WarehouseReceivingService, { listReceivingTasks });
      router.service(WarehouseStockService, {
        listStockBalances: ({ page, warehouseId }) => {
          expect(warehouseId).toBe(WAREHOUSE);
          expect(page?.pageSize).toBe(200);
          const isFirstPage = page?.pageToken === '';
          return create(ListStockBalancesResponseSchema, {
            balances: [{ handlingUnit: { id: isFirstPage ? 'unit-1' : 'unit-2' } }],
            page: { nextPageToken: isFirstPage ? 'second' : '' },
          });
        },
        listStockMovements,
      });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );
  const { result } = renderHook(() => useWarehouseWorkspace(WAREHOUSE, 'stock'), { wrapper: Wrapper });

  await waitFor(() => {
    expect(result.current.balances.data?.map(balance => balance.handlingUnit?.id)).toEqual(['unit-1', 'unit-2']);
    expect(result.current.topology.data).toBeNull();
  });
  expect(result.current.canViewInventory).toBe(true);
  expect(result.current.canViewTasks).toBe(false);
  expect(listPickingTasks).not.toHaveBeenCalled();
  expect(listReceivingTasks).not.toHaveBeenCalled();
  expect(listStockMovements).not.toHaveBeenCalled();

  const cached = queryClient.getQueryCache().getAll();
  const scope = ['warehouse-workspace', TEST_ORGANIZATION_ID, TEST_USER_ID, WAREHOUSE];
  const readMeta = (kind: string): unknown => cached.find(query => query.queryKey.join(':') === [...scope, kind].join(':'))?.meta;
  expect(readMeta('balances')).toEqual({ channels: [inventoryChannel(WAREHOUSE)], eventCases: ['stockChanged'] });
  expect(readMeta('topology')).toEqual({ channels: [warehouseChannel(WAREHOUSE)], eventCases: ['warehouseChanged'] });
  expect(cached.some(query => query.meta?.channels?.includes(tasksChannel(WAREHOUSE)) === true)).toBe(false);

  act(() => {
    runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER });
  });
  expect(result.current.balances.data).toBeUndefined();
});

it('resolves a cell only inside warehouses the persona can read', async () => {
  const targetCellId = '80000000-0000-4000-8000-000000000004';
  const warehouses = [create(WarehouseSchema, { id: WAREHOUSE }), create(WarehouseSchema, { id: OTHER_WAREHOUSE })];
  const getWarehouseTopology = vi.fn(() => create(GetWarehouseTopologyResponseSchema, {
    topology: { storageZones: [{ rows: [{ racks: [{ tiers: [{ cells: [{ id: targetCellId }] }] }] }] }] },
  }));
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(AccessService, {
        getSession: () => create(GetSessionResponseSchema, {
          permissions: [{ permission: 'warehouse_view', warehouseIds: [WAREHOUSE] }],
        }),
      });
      router.service(WarehouseTopologyService, { getWarehouseTopology });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  const { result } = renderHook(
    () => useWarehouseObjectLookup({ id: targetCellId, type: 'cell' }, warehouses),
    { wrapper: Wrapper },
  );

  await waitFor(() => {
    expect(result.current.warehouseId).toBe(WAREHOUSE);
  });
  expect(getWarehouseTopology).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ warehouseId: WAREHOUSE }), expect.anything());
  expect(result.current.isPending).toBe(false);
});
