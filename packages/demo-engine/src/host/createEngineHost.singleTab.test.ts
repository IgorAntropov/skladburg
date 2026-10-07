import { Code } from '@connectrpc/connect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { HostHarnessValue } from './testing/hostHarness';

import {
  createHeaders,
  createWarehouseRequest,
} from '../core/engine/testing/engineHarness';
import {
  callAs,
  captureError,
} from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import {
  CHECKPOINT_INTERVAL_MS,
  ENGINE_LOCK_NAME,
} from './constants';
import { createFakeIndexedDbStorage } from './testing/fakeIndexedDbStorage';
import {
  countMessages,
  createHostHarness,
  readLastStatus,
  readStatuses,
} from './testing/hostHarness';
import {
  createGate,
  WAIT_OPTIONS,
  waitForInbox,
  waitForRole,
} from './testing/hostScenario';
import { subscribeRecorded } from './testing/recordedSubscription';

const KEY_1 = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';

const BUYER_CHANNEL = `org:${SeedOrganizationId.BUYER_1}`;
const buyerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);

let harness: HostHarnessValue;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  harness = createHostHarness();
});

afterEach(async () => {
  await harness.close();
  vi.restoreAllMocks();
});

describe('engine host in the single-tab mode', () => {
  it('becomes the leader at once with the single-tab coordination and without any lock', async () => {
    const fixture = harness.addHost({ isSingleTab: true });

    await waitForRole(fixture, 'leader');

    expect(readStatuses(fixture)).toEqual([
      {
        coordination: 'single-tab',
        epoch: readLastStatus(fixture)?.epoch,
        role: 'leader',
        storage: 'memory',
        storageHealth: 'ok',
      },
    ]);
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(false);
  });

  it('never creates a broadcast channel', async () => {
    const fixture = harness.addHost({ isSingleTab: true });
    await waitForRole(fixture, 'leader');

    await fixture.organization().listWarehouses({}, buyerOptions);
    await fixture.stop();

    expect(harness.openedChannelCount()).toBe(0);
  });

  it('serves requests and delivers the events of its own commands to its subscribers', async () => {
    const fixture = harness.addHost({ isSingleTab: true });
    await waitForRole(fixture, 'leader');
    const recorded = subscribeRecorded(
      fixture,
      `org:${SeedOrganizationId.BUYER_1}`,
      createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1),
    );
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);

    const listed = await fixture.organization().listWarehouses({}, buyerOptions);
    await fixture.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);

    expect(listed.warehouses).toHaveLength(3);
    await vi.waitFor(() => {
      expect(recorded.events.length).toBeGreaterThan(0);
    }, WAIT_OPTIONS);
    expect(countMessages(fixture, 'status')).toBe(1);
  });

  it('never opens the storage of the browser and runs the world in memory', async () => {
    const storage = createFakeIndexedDbStorage();
    const openStorage = vi.fn(() => Promise.resolve({ kind: 'indexed-db', storage } as const));
    const fixture = harness.addHost({ isSingleTab: true, openStorage });
    await waitForRole(fixture, 'leader');

    await fixture.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    harness.realTime.advance(CHECKPOINT_INTERVAL_MS);
    harness.timers.advance(CHECKPOINT_INTERVAL_MS);
    await fixture.stop();

    expect(openStorage).not.toHaveBeenCalled();
    expect(readStatuses(fixture)).toEqual([
      {
        coordination: 'single-tab',
        epoch: readLastStatus(fixture)?.epoch,
        role: 'leader',
        storage: 'memory',
        storageHealth: 'ok',
      },
    ]);
    expect(storage.writeAttemptCount()).toBe(0);
    expect(storage.clearCount()).toBe(0);
    expect(storage.closeCount()).toBe(0);
    expect(harness.storage.loadCount()).toBe(0);
    expect(harness.storage.commits).toEqual([]);
    expect(harness.timers.activeCount()).toBe(0);
  });

  it('keeps two single-tab tabs in separate worlds without touching the shared storage', async () => {
    const storage = createFakeIndexedDbStorage();
    const openStorage = vi.fn(() => Promise.resolve({ kind: 'indexed-db', storage } as const));
    const first = harness.addHost({ isSingleTab: true, openStorage });
    const second = harness.addHost({ isSingleTab: true, openStorage });
    await waitForRole(first, 'leader');
    await waitForRole(second, 'leader');

    await first.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    harness.realTime.advance(CHECKPOINT_INTERVAL_MS);
    harness.timers.advance(CHECKPOINT_INTERVAL_MS);

    expect((await first.organization().listWarehouses({}, buyerOptions)).warehouses).toHaveLength(4);
    expect((await second.organization().listWarehouses({}, buyerOptions)).warehouses).toHaveLength(3);
    expect(openStorage).not.toHaveBeenCalled();
    expect(storage.writeAttemptCount()).toBe(0);
    expect(storage.closeCount()).toBe(0);
    expect(readLastStatus(first)).toMatchObject({ coordination: 'single-tab', storage: 'memory' });
    expect(readLastStatus(second)).toMatchObject({ coordination: 'single-tab', storage: 'memory' });
  });

  it('stops cleanly before the engine has started', async () => {
    const fixture = harness.addHost({ isSingleTab: true });

    await fixture.stop();

    expect(harness.timers.activeCount()).toBe(0);
    expect(harness.openedChannelCount()).toBe(0);
  });

  it('keeps hosts with a lock manager in the shared coordination', async () => {
    const fixture = harness.addHost();

    await waitForRole(fixture, 'leader');

    expect(readLastStatus(fixture)?.coordination).toBe('shared');
    expect(harness.openedChannelCount()).toBe(1);
  });
});

describe('engine host in the single-tab mode when the start fails', () => {
  it('tells the tab that the engine is unavailable and never sends a status', async () => {
    const fixture = harness.addHost({
      isSingleTab: true,
      loadCore: () => Promise.reject(new Error('The engine core is not loaded')),
    });

    await vi.waitFor(() => {
      expect(countMessages(fixture, 'engine_unavailable')).toBe(1);
    }, WAIT_OPTIONS);

    expect(fixture.messages[0]).toEqual({ reason: 'start_failed', type: 'engine_unavailable' });
    expect(countMessages(fixture, 'status')).toBe(0);
  });

  it('fails the calls made before and after the failure at once, without waiting for the timeout', async () => {
    const loadGate = createGate();
    const fixture = harness.addHost({
      isSingleTab: true,
      loadCore: async () => {
        await loadGate.promise;

        throw new Error('The engine core is not loaded');
      },
    });
    const callBeforeFailure = captureError(fixture.organization().listWarehouses({}, buyerOptions));
    const controlBeforeFailure = captureError(fixture.connection.control.listPersonas());
    await waitForInbox(fixture, 'request');
    await waitForInbox(fixture, 'control');

    loadGate.open();

    expect((await callBeforeFailure).code).toBe(Code.Unavailable);
    expect((await controlBeforeFailure).code).toBe(Code.Unavailable);
    expect((await captureError(fixture.organization().listWarehouses({}, buyerOptions))).code).toBe(Code.Unavailable);
    expect((await captureError(fixture.connection.control.reset())).code).toBe(Code.Unavailable);
    expect(countMessages(fixture, 'transport_error')).toBe(4);
    expect(countMessages(fixture, 'status')).toBe(0);
    expect(harness.timers.activeCount()).toBe(0);
  });

  it('gives no reply to a subscription and ignores an unsubscribe', async () => {
    const fixture = harness.addHost({
      isSingleTab: true,
      loadCore: () => Promise.reject(new Error('The engine core is not loaded')),
    });
    await vi.waitFor(() => {
      expect(countMessages(fixture, 'engine_unavailable')).toBe(1);
    }, WAIT_OPTIONS);

    const recorded = subscribeRecorded(
      fixture,
      BUYER_CHANNEL,
      createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1),
    );
    await waitForInbox(fixture, 'subscribe');
    recorded.unsubscribe();
    await waitForInbox(fixture, 'unsubscribe');
    await captureError(fixture.organization().listWarehouses({}, buyerOptions));

    expect(fixture.messages.map(message => message.type)).toEqual(['engine_unavailable', 'transport_error']);
    expect(recorded.positions).toHaveLength(0);
    expect(recorded.denied).toHaveLength(0);
  });
});
