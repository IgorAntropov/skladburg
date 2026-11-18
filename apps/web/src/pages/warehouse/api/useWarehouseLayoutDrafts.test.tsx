import type { GetWarehouseLayoutDraftsResponse } from '@skladburg/contracts/wms/v1/layout_session';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EventSchema } from '@skladburg/contracts/event/v1/event';
import { layoutChannel } from '@skladburg/contracts/runtime';
import {
  GetWarehouseLayoutDraftsResponseSchema,
  WarehouseLayoutSessionService,
} from '@skladburg/contracts/wms/v1/layout_session';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
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

import type { IRealtimeChannel } from '@/shared/api';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';

import { useWarehouseLayoutDrafts } from './useWarehouseLayoutDrafts';

const WAREHOUSE = '80000000-0000-4000-8000-000000000001';
const CHANNEL = layoutChannel(WAREHOUSE);
const TOPOLOGY = create(WarehouseTopologySchema, { revision: 2, warehouseId: WAREHOUSE });
const SERVER_NOW = timestampFromMs(170_000_000);
const EMPTY_RESPONSE = create(GetWarehouseLayoutDraftsResponseSchema, { serverTime: SERVER_NOW });
const LATEST_RESPONSE = create(GetWarehouseLayoutDraftsResponseSchema, {
  drafts: [{
    baseRevision: 2,
    expiresAt: timestampFromMs(170_120_000),
    footprint: { depthMm: 1_000, origin: { xMm: 5_100, zMm: 1_000 }, widthMm: 1_200 },
    rowId: 'row-1',
    zoneId: 'zone-1',
  }],
  serverTime: SERVER_NOW,
});

afterEach(cleanup);

it('reads after the subscription is accepted and replaces an initial request when a draft changes in flight', async () => {
  let resolveFirst: ((response: GetWarehouseLayoutDraftsResponse) => void) | undefined;
  const getDrafts = vi.fn<() => Promise<GetWarehouseLayoutDraftsResponse>>()
    .mockImplementationOnce(() => new Promise((resolve) => {
      resolveFirst = resolve;
    }))
    .mockResolvedValue(LATEST_RESPONSE);
  const subscribe = vi.fn<IRealtimeChannel['subscribe']>(() => () => undefined);
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(WarehouseLayoutSessionService, { getWarehouseLayoutDrafts: getDrafts });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  const realtime = { stop: runtime.realtime.stop, subscribe };
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={{ ...runtime, realtime }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );
  const { result } = renderHook(() => useWarehouseLayoutDrafts(TOPOLOGY, WAREHOUSE), { wrapper: Wrapper });
  const [subscription] = subscribe.mock.calls;

  expect(subscription?.[0]).toBe(CHANNEL);
  expect(getDrafts).not.toHaveBeenCalled();
  act(() => {
    subscription?.[2]?.();
  });
  await waitFor(() => {
    expect(getDrafts).toHaveBeenCalledOnce();
  });
  act(() => {
    subscription?.[1]({
      events: [create(EventSchema, {
        channel: CHANNEL, payload: { case: 'warehouseLayoutDraftsChanged', value: { warehouseId: WAREHOUSE } },
      })],
      kind: 'events',
    });
  });
  await waitFor(() => {
    expect(result.current.drafts[0]?.footprint.origin.xMm).toBe(5_100);
    expect(getDrafts).toHaveBeenCalledTimes(2);
  });
  await act(async () => {
    resolveFirst?.(EMPTY_RESPONSE);
    await Promise.resolve();
  });
  expect(result.current.drafts).toHaveLength(1);
});
