import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { RenderHookResult } from '@testing-library/react';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  AccessService,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  ListYardVehicleMarkingsResponseSchema,
  WarehouseReceivingService,
  YardVehicleAccent,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  QueryClient,
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
} from 'vitest';

import { ApiRuntimeProvider } from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';

import { useWarehouseYardVehicleMarkings } from './useWarehouseYardVehicleMarkings';

const WAREHOUSE = '80000000-0000-4000-8000-000000000001';
const TASK = '80000000-0000-4000-8000-000000000002';
const OTHER_ORGANIZATION = '80000000-0000-4000-8000-000000000003';
const NEXT_TASK = '80000000-0000-4000-8000-000000000004';
const PLATE = 'А001АА 000';

interface MarkingsControlValue {
  canReadNumber: boolean;
  hasWarehouseAccess: boolean;
  isDenied: boolean;
  replyGate: Promise<void> | undefined;
}

interface MarkingsHarnessValue {
  calls: string[][];
  client: QueryClient;
  control: MarkingsControlValue;
  hook: RenderHookResult<ReturnType<typeof useWarehouseYardVehicleMarkings>, readonly string[]>;
  readSession: () => GetSessionResponse;
  runtime: ReturnType<typeof createTestRuntime>;
}

const mountMarkings = (taskIds: readonly string[] = [TASK]): MarkingsHarnessValue => {
  const control: MarkingsControlValue = { canReadNumber: true, hasWarehouseAccess: true, isDenied: false, replyGate: undefined };
  const calls: string[][] = [];
  const readSession = (): GetSessionResponse => create(GetSessionResponseSchema, {
    permissions: [
      ...control.hasWarehouseAccess ? [{ permission: 'task_view', warehouseIds: [WAREHOUSE] }] : [],
      ...control.canReadNumber ? [{ isOrganizationWide: true, permission: 'trip_view' }] : [],
    ],
  });
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(AccessService, { getSession: readSession });
      router.service(WarehouseReceivingService, {
        listYardVehicleMarkings: async ({ taskIds, warehouseId }) => {
          expect(warehouseId).toBe(WAREHOUSE);
          calls.push(taskIds);
          await control.replyGate;
          if (control.isDenied) {
            throw new ConnectError('Warehouse access revoked', Code.PermissionDenied);
          }

          return create(ListYardVehicleMarkingsResponseSchema, {
            markings: taskIds.map(taskId => ({
              brand: { logo: { lightUrl: 'logos/carrier-1-light.svg' }, name: 'Перевозчик 1', yardAccent: YardVehicleAccent.BLUE },
              registrationNumber: control.canReadNumber ? PLATE : undefined,
              taskId,
            })),
          });
        },
      });
    },
  });
  const client = new QueryClient({ defaultOptions: { queries: { networkMode: 'always', retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );
  const hook = renderHook((ids: readonly string[]) => useWarehouseYardVehicleMarkings(WAREHOUSE, ids, true), {
    initialProps: taskIds, wrapper,
  });

  return { calls, client, control, hook, readSession, runtime };
};

afterEach(cleanup);

it('requests visible visits in batches and projects the authorized number and brand', async () => {
  const moreTasks = Array.from({ length: 100 }, (_, index) => `90000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
  const { calls, hook } = mountMarkings([TASK, ...moreTasks, TASK]);

  await waitFor(() => {
    expect(hook.result.current?.size).toBe(101);
  });
  expect(calls.map(batch => batch.length).toSorted()).toEqual([1, 100]);
  expect(hook.result.current?.get(TASK)).toEqual({
    accent: 'blue', brandName: 'Перевозчик 1', logoPath: 'logos/carrier-1-light.svg', registrationNumber: PLATE,
  });
});

it('drops the previous number when the session loses trip read access', async () => {
  const { calls, client, control, hook, readSession } = mountMarkings();
  await waitFor(() => {
    expect(hook.result.current?.get(TASK)?.registrationNumber).toBe(PLATE);
  });

  control.canReadNumber = false;
  act(() => {
    client.setQueryData(['session', 'current', TEST_ORGANIZATION_ID, TEST_USER_ID], readSession());
  });
  await waitFor(() => {
    expect(calls).toHaveLength(2);
    expect(hook.result.current?.get(TASK)).toMatchObject({ brandName: 'Перевозчик 1', registrationNumber: undefined });
  });
});

it('keeps a confirmed marking for the same visit until the new arrivals are read', async () => {
  const { calls, control, hook } = mountMarkings();
  await waitFor(() => {
    expect(hook.result.current?.get(TASK)?.registrationNumber).toBe(PLATE);
  });

  let finish = (): void => undefined;
  control.replyGate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  hook.rerender([TASK, NEXT_TASK]);

  try {
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });
    expect(hook.result.current?.get(TASK)?.registrationNumber).toBe(PLATE);
    expect(hook.result.current?.get(NEXT_TASK)).toBeUndefined();
  }
  finally {
    finish();
  }

  await waitFor(() => {
    expect(hook.result.current?.get(NEXT_TASK)?.registrationNumber).toBe(PLATE);
  });
});

it('drops cached data for a forbidden refetch and a different acting organization', async () => {
  const { client, control, hook, runtime } = mountMarkings();
  await waitFor(() => {
    expect(hook.result.current?.get(TASK)?.registrationNumber).toBe(PLATE);
  });

  control.isDenied = true;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['warehouse-workspace'] });
  });
  await waitFor(() => {
    expect(hook.result.current).toBeUndefined();
  });

  control.isDenied = false;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['warehouse-workspace'] });
  });
  await waitFor(() => {
    expect(hook.result.current?.get(TASK)?.registrationNumber).toBe(PLATE);
  });

  control.hasWarehouseAccess = false;
  act(() => {
    runtime.actingContext.set({ organizationId: OTHER_ORGANIZATION, userId: TEST_USER_ID });
  });
  await waitFor(() => {
    expect(hook.result.current).toBeUndefined();
  });
});
