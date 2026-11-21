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
  staffChannel,
  staffProfilesChannel,
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
import {
  GetWarehouseEquipmentResponseSchema,
  WarehouseEquipmentService,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import {
  GetWarehouseStaffPresenceResponseSchema,
  WarehouseStaffPresenceService,
} from '@skladburg/contracts/wms/v1/warehouse_staff_presence';
import {
  GetWarehouseStaffProfileResponseSchema,
  ListWarehouseStaffResponseSchema,
  WarehouseStaffProfileService,
} from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
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

import { sessionKeys } from '@/entities/session';
import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';

import { useWarehouseEquipment } from './useWarehouseEquipment';
import { useWarehouseObjectLookup } from './useWarehouseObjectLookup';
import { useWarehouseSceneStaff } from './useWarehouseSceneStaff';
import { useWarehouseStaffPresence } from './useWarehouseStaffPresence';
import { useWarehouseStaffProfile } from './useWarehouseStaffProfiles';
import { useWarehouseWorkspace } from './useWarehouseWorkspace';
import { useWarehouseYardRefresh } from './useWarehouseYardRefresh';

const WAREHOUSE = '80000000-0000-4000-8000-000000000001';
const OTHER_WAREHOUSE = '80000000-0000-4000-8000-000000000002';
const OTHER_USER = '80000000-0000-4000-8000-000000000003';

function createDeferred<T>(value: T): { promise: Promise<T>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<T>((finish) => {
    resolve = (): void => {
      finish(value);
    };
  });

  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('refreshes available yard sources once and waits for their results to reach the snapshot', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const initialData = ['before'];
  const fetchedData = ['after'];
  const received = { data: fetchedData, dataUpdatedAt: 1, errorUpdatedAt: 0 };
  const deferred = createDeferred(received);
  const refetch = vi.fn(() => deferred.promise);
  const view = { data: initialData, dataUpdatedAt: 1, errorUpdatedAt: 0, fetchStatus: 'idle', refetch } as const;
  const { rerender, result } = renderHook(
    ({ data }) => useWarehouseYardRefresh('current', undefined, { ...view, data }, undefined),
    { initialProps: { data: initialData } },
  );

  expect(result.current).toBe(false);
  act(() => {
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(result.current).toBe(true);
  expect(refetch).not.toHaveBeenCalled();

  act(() => {
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(refetch).toHaveBeenCalledOnce();
  await act(async () => {
    deferred.resolve();
    await deferred.promise;
  });
  expect(result.current).toBe(true);

  rerender({ data: fetchedData });
  expect(result.current).toBe(false);
});

it('never resumes a different acting scope from the previous in-flight refresh', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const received = { data: [], dataUpdatedAt: 1, errorUpdatedAt: 0 };
  const deferred = createDeferred(received);
  const refetch = vi.fn(() => deferred.promise);
  const view = { ...received, fetchStatus: 'idle', refetch } as const;
  const { rerender, result } = renderHook(
    ({ scope }) => useWarehouseYardRefresh(scope, scope === 'previous' ? view : undefined, undefined, undefined),
    { initialProps: { scope: 'previous' } },
  );

  act(() => {
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(result.current).toBe(true);
  expect(refetch).toHaveBeenCalledOnce();

  rerender({ scope: 'current' });
  await act(async () => {
    deferred.resolve();
    await deferred.promise;
  });
  expect(result.current).toBe(false);
  expect(refetch).toHaveBeenCalledOnce();
});

it('restarts a pending refresh when an available query reader changes in the same visible scope', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const received = { data: [], dataUpdatedAt: 1, errorUpdatedAt: 0 };
  const previous = createDeferred(received);
  const current = createDeferred(received);
  const refetchPrevious = vi.fn(() => previous.promise);
  const refetchCurrent = vi.fn(() => current.promise);
  const { rerender, result } = renderHook(
    ({ refetch }) => useWarehouseYardRefresh('same', undefined, { ...received, fetchStatus: 'idle', refetch }, undefined),
    { initialProps: { refetch: refetchPrevious } },
  );

  act(() => {
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(result.current).toBe(true);
  expect(refetchPrevious).toHaveBeenCalledOnce();

  rerender({ refetch: refetchCurrent });
  await act(async () => {
    previous.resolve();
    await previous.promise;
  });
  expect(result.current).toBe(true);
  expect(refetchCurrent).toHaveBeenCalledOnce();

  await act(async () => {
    current.resolve();
    await current.promise;
  });
  expect(result.current).toBe(false);
});

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

it('reads the shift and subscribes to staff events only in the granted warehouse', async () => {
  const getSession = vi.fn(() => create(GetSessionResponseSchema, {
    permissions: [{ permission: 'staff_view', warehouseIds: [WAREHOUSE] }],
  }));
  const getWarehouseStaffPresence = vi.fn(() => create(GetWarehouseStaffPresenceResponseSchema, {
    areas: [{ areaCode: 'A01', areaId: 'receiving', observedStaffCount: 2, plannedStaffCount: 0 }],
    shift: { offSiteCount: 1, onBreakCount: 2, onShiftCount: 3 },
  }));
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(AccessService, { getSession });
      router.service(WarehouseStaffPresenceService, { getWarehouseStaffPresence });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  queryClient.setQueryDefaults(sessionKeys.all, { retry: false });
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );
  const { rerender, result } = renderHook(({ id }) => useWarehouseStaffPresence(id), {
    initialProps: { id: WAREHOUSE },
    wrapper: Wrapper,
  });

  await waitFor(() => {
    expect(result.current.data?.areas[0]).toMatchObject({ areaCode: 'A01', observedStaffCount: 2, plannedStaffCount: 0 });
    expect(result.current.data?.shift).toMatchObject({ offSiteCount: 1, onBreakCount: 2, onShiftCount: 3 });
  });
  const staffQuery = queryClient.getQueryCache().find({
    exact: false,
    queryKey: ['warehouse-workspace', TEST_ORGANIZATION_ID, TEST_USER_ID, WAREHOUSE],
  });
  expect(staffQuery?.meta).toEqual({ channels: [staffChannel(WAREHOUSE)], eventCases: ['warehouseStaffPresenceChanged'] });
  rerender({ id: OTHER_WAREHOUSE });
  expect(result.current.data).toBeUndefined();
  expect(result.current.isFetching).toBe(false);
  expect(queryClient.getQueryCache().getAll().some(entry => entry.meta?.channels?.includes(staffChannel(OTHER_WAREHOUSE)))).toBe(false);
  expect(getWarehouseStaffPresence).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ warehouseId: WAREHOUSE }), expect.anything());

  rerender({ id: WAREHOUSE });
  await waitFor(() => {
    expect(result.current.data?.areas).toHaveLength(1);
  });
  getSession.mockImplementationOnce(() => {
    throw new Error('session unavailable');
  });
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: sessionKeys.all });
  });
  await waitFor(() => {
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
  act(() => {
    result.current.refetch();
  });
  await waitFor(() => {
    expect(result.current.error).toBeNull();
    expect(result.current.data?.areas).toHaveLength(1);
  });
  act(() => {
    runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER });
  });
  expect(result.current.data).toBeUndefined();
});

it('drops equipment assignments immediately when the warehouse, employee or field permissions change', async () => {
  const warehouseAccess = { permission: 'warehouse_view', warehouseIds: [WAREHOUSE] };
  const fullSession = create(GetSessionResponseSchema, {
    permissions: [warehouseAccess, ...['staff_profile_view', 'task_view'].map(permission => ({ permission, warehouseIds: [WAREHOUSE] }))],
  });
  const limitedSession = create(GetSessionResponseSchema, { permissions: [warehouseAccess] });
  const visible = create(GetWarehouseEquipmentResponseSchema, { equipment: [{ code: '01', driverStaffId: TEST_USER_ID, taskId: 'task' }] });
  const hidden = createDeferred(create(GetWarehouseEquipmentResponseSchema, { equipment: [{ code: '01' }] }));
  const getWarehouseEquipment = vi.fn<() => Promise<typeof visible>>()
    .mockResolvedValueOnce(visible)
    .mockReturnValue(hidden.promise);
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(AccessService, { getSession: () => fullSession });
      router.service(WarehouseEquipmentService, { getWarehouseEquipment });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );
  const { rerender, result } = renderHook(({ enabled, id }) => useWarehouseEquipment(id, enabled), {
    initialProps: { enabled: false, id: WAREHOUSE },
    wrapper: Wrapper,
  });
  const key = sessionKeys.current(TEST_ORGANIZATION_ID, TEST_USER_ID);
  await waitFor(() => {
    expect(queryClient.getQueryData(key)).toBeDefined();
  });
  expect(getWarehouseEquipment).not.toHaveBeenCalled();
  rerender({ enabled: true, id: WAREHOUSE });
  await waitFor(() => {
    expect(result.current.data?.equipment[0]?.driverStaffId).toBe(TEST_USER_ID);
  });
  const equipmentQuery = (): Readonly<Record<string, unknown>> | undefined => queryClient.getQueryCache().getAll()
    .find(query => query.getObserversCount() > 0 && query.queryKey.includes('equipment'))?.meta;
  expect(equipmentQuery()).toEqual({
    channels: [warehouseChannel(WAREHOUSE), staffProfilesChannel(WAREHOUSE)],
    eventCases: ['warehouseEquipmentChanged', 'warehouseStaffProfilesChanged'],
  });

  act(() => {
    queryClient.setQueryData(key, limitedSession);
  });
  await waitFor(() => {
    expect(getWarehouseEquipment).toHaveBeenCalledTimes(2);
  });
  expect(result.current.data).toBeUndefined();
  expect(equipmentQuery()).toEqual({ channels: [warehouseChannel(WAREHOUSE)], eventCases: ['warehouseEquipmentChanged'] });
  await act(async () => {
    hidden.resolve();
    await hidden.promise;
  });
  await waitFor(() => {
    expect(result.current.data?.equipment[0]?.code).toBe('01');
  });
  expect(result.current.data?.equipment[0]?.taskId).toBeUndefined();
  rerender({ enabled: true, id: OTHER_WAREHOUSE });
  expect(result.current.data).toBeUndefined();
  expect(equipmentQuery()).toBeUndefined();
  expect(getWarehouseEquipment).toHaveBeenCalledTimes(2);

  rerender({ enabled: true, id: WAREHOUSE });
  await waitFor(() => {
    expect(result.current.data?.equipment[0]?.code).toBe('01');
  });
  act(() => {
    runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER });
  });
  expect(result.current.data).toBeUndefined();
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

it('drops personal fields and their subscriptions when the acting employee or warehouse changes', async () => {
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(AccessService, { getSession: () => create(GetSessionResponseSchema, {
        permissions: [{ permission: 'staff_profile_view', warehouseIds: [WAREHOUSE] }],
      }) });
      router.service(WarehouseStaffProfileService, { getWarehouseStaffProfile: () => create(GetWarehouseStaffProfileResponseSchema, {
        profile: { qualifications: { entries: [] } },
      }) });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );
  const { rerender, result } = renderHook(({ id }) => useWarehouseStaffProfile(id, TEST_USER_ID), {
    initialProps: { id: WAREHOUSE },
    wrapper: Wrapper,
  });

  await waitFor(() => {
    expect(result.current.data?.profile?.qualifications).toBeDefined();
  });
  const subscribed = queryClient.getQueryCache().getAll().find(query => query.meta?.channels?.includes(staffProfilesChannel(WAREHOUSE)));
  expect(subscribed?.meta?.eventCases).toEqual(['warehouseStaffProfilesChanged']);
  act(() => {
    runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER });
  });
  expect(result.current.data).toBeUndefined();
  rerender({ id: OTHER_WAREHOUSE });
  expect(result.current.data).toBeUndefined();
  expect(result.current.isFetching).toBe(false);
  const other = queryClient.getQueryCache().getAll().filter(query => query.meta?.channels?.includes(staffProfilesChannel(OTHER_WAREHOUSE)));
  expect(other).toHaveLength(0);
});

it('queries scene staff only with a live camera and closes the selection on object and actor changes', async () => {
  const listWarehouseStaff = vi.fn(() => create(ListWarehouseStaffResponseSchema, {
    staff: [{ observedAreaId: 'receiving', staffId: TEST_USER_ID, warehouseId: WAREHOUSE }],
  }));
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(AccessService, { getSession: () => create(GetSessionResponseSchema, {
        permissions: [{ permission: 'staff_profile_view', warehouseIds: [WAREHOUSE] }],
      }) });
      router.service(WarehouseStaffProfileService, { listWarehouseStaff });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => withTestLocalizer(
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>,
  );
  const { rerender, result } = renderHook(({ focus, ready }) => useWarehouseSceneStaff(WAREHOUSE, ready, focus), {
    initialProps: { focus: 1, ready: false },
    wrapper: Wrapper,
  });
  await waitFor(() => {
    expect(queryClient.getQueryCache().find({ exact: false, queryKey: sessionKeys.all })?.state.status).toBe('success');
  });
  expect(listWarehouseStaff).not.toHaveBeenCalled();
  rerender({ focus: 1, ready: true });
  await waitFor(() => {
    expect(result.current.staffAreas[0]?.staff[0]?.staffId).toBe(TEST_USER_ID);
  });
  expect(result.current.staffAreas[0]?.counter).toBeUndefined();
  act(() => {
    result.current.selectStaff(OTHER_USER);
  });
  expect(result.current.selectedStaffId).toBeUndefined();
  act(() => {
    result.current.selectStaff(TEST_USER_ID);
  });
  expect(result.current.selectedStaffId).toBe(TEST_USER_ID);
  rerender({ focus: 2, ready: true });
  expect(result.current.selectedStaffId).toBeUndefined();
  act(() => {
    result.current.selectStaff(TEST_USER_ID);
  });
  act(() => {
    runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER });
  });
  expect(result.current.selectedStaffId).toBeUndefined();
  expect(result.current.staffAreas).toEqual([]);
});
