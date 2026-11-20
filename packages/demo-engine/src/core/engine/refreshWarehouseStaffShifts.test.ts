import type { Event } from '@skladburg/contracts/event/v1/event';

import { createClient } from '@connectrpc/connect';
import { staffChannel } from '@skladburg/contracts/runtime';
import { WarehouseStaffPresenceService } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';
import {
  expect,
  it,
} from 'vitest';

import { callAs } from '../modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../seed/seedIds';
import { createSeedSnapshot } from '../seed/seedSnapshot';
import { SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID } from '../seed/seedWarehouseWorkspaceConfig';
import { createEngineWithTasks } from './createEngine';
import {
  createEngineTransport,
  createFakeRealTime,
  createSpyStorage,
} from './testing/engineHarness';

it('publishes once across missed ticks, failed writes, restart and reset even with a scheduler backlog', async () => {
  const warehouseId = SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID;
  const initial = createSeedSnapshot();
  const worldTimeMs = Date.UTC(2026, 9, 12, 8, 59, 58, 500);
  const storage = createSpyStorage({ ...initial, meta: { ...initial.meta, worldTimeMs } });
  const realTime = createFakeRealTime();
  const open = (epoch: string): ReturnType<typeof createEngineWithTasks> =>
    createEngineWithTasks({ epoch, realTime, storage }, () => [{ id: 'backlog', intervalMs: 1_000, run: () => undefined }]);
  const director = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
  const events: Event[] = [];
  const collect = (batch: readonly Event[]): void => {
    events.push(...batch);
  };
  const first = await open('first');
  expect(first.subscribe(staffChannel(warehouseId), new Headers(director.headers), collect).kind).toBe('subscribed');
  realTime.advance(1_000);
  await first.tick();
  expect(events).toHaveLength(0);
  storage.failNextCommit();
  realTime.advance(1_600);
  await expect(first.tick()).rejects.toThrow();
  expect(events).toHaveLength(0);
  realTime.advance(1_000);
  await first.tick();
  expect(events).toMatchObject([{ payload: { case: 'warehouseStaffPresenceChanged', value: { warehouseId } }, seq: 1n }]);
  realTime.advance(10_000);
  await first.tick();
  expect(events).toHaveLength(1);
  await first.checkpoint();

  const second = await open('restored');
  const reader = createClient(WarehouseStaffPresenceService, createEngineTransport(second, true));
  expect((await reader.getWarehouseStaffPresence({ warehouseId }, director)).shift).toMatchObject({ onBreakCount: 2, onShiftCount: 1 });
  expect(second.subscribe(staffChannel(warehouseId), new Headers(director.headers), collect).kind).toBe('subscribed');
  realTime.advance(30 * 60_000);
  await second.tick();
  expect(events.map(event => event.seq)).toEqual([1n, 2n]);
  expect((await reader.getWarehouseStaffPresence({ warehouseId }, director)).shift).toMatchObject({ onBreakCount: 1, onShiftCount: 2 });
  realTime.advance(60 * 60_000);
  await second.tick();
  expect(events.map(event => event.seq)).toEqual([1n, 2n, 3n]);
  expect((await reader.getWarehouseStaffPresence({ warehouseId }, director)).shift).toMatchObject({ onBreakCount: 0, onShiftCount: 3 });
  realTime.advance(4 * 3_600_000);
  await second.tick();
  expect(events.map(event => event.seq)).toEqual([1n, 2n, 3n, 4n]);

  const snapshot = await storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing saved shift');
  }
  await storage.replaceAll({ ...snapshot, meta: { ...snapshot.meta, timeScale: 0 } });
  const paused = await open('paused');
  expect(paused.subscribe(staffChannel(warehouseId), new Headers(director.headers), collect).kind).toBe('subscribed');
  realTime.advance(8 * 3_600_000);
  await paused.tick();
  const pausedReader = createClient(WarehouseStaffPresenceService, createEngineTransport(paused, true));
  const { shift } = await pausedReader.getWarehouseStaffPresence({ warehouseId }, director);
  expect(shift).toMatchObject({ offSiteCount: 3, onBreakCount: 0, onShiftCount: 0 });
  await paused.reset('new-world');
  realTime.advance(60_000);
  await paused.tick();
  expect(events.map(event => event.seq)).toEqual([1n, 2n, 3n, 4n]);
  const reset = await pausedReader.getWarehouseStaffPresence({ warehouseId }, director);
  expect(reset.shift).toMatchObject({ onBreakCount: 0, onShiftCount: 3 });
  realTime.advance(3 * 3_600_000);
  const duringBreak = await pausedReader.getWarehouseStaffPresence({ warehouseId }, director);
  expect(duringBreak.shift).toMatchObject({ onBreakCount: 2, onShiftCount: 1 });
  realTime.advance(3_600_000);
  await paused.tick();
  expect(events.slice(4)).toMatchObject([{ epoch: 'new-world', seq: 1n }]);
  realTime.advance(60_000);
  await paused.tick();
  expect(events).toHaveLength(5);
});
