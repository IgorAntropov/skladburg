import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { HostHarnessValue } from './testing/hostHarness';

import { createEngine } from '../core/engine/createEngine';
import { createHeaders } from '../core/engine/testing/engineHarness';
import { callAs } from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import {
  createTabLockName,
  ENGINE_LOCK_NAME,
} from './constants';
import {
  countMessages,
  createHostHarness,
  readLastStatus,
  readStatuses,
} from './testing/hostHarness';
import {
  countOutboxMessages,
  createGate,
  readSubscriptionId,
  settleChannels,
  WAIT_OPTIONS,
  waitForInbox,
  waitForRole,
} from './testing/hostScenario';
import { subscribeRecorded } from './testing/recordedSubscription';

const DEAD_EPOCH = 'epoch-of-the-dead-leader';
const BUYER_CHANNEL = organizationChannel(SeedOrganizationId.BUYER_1);
const buyerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);

let harness: HostHarnessValue;

const staleLeaderReady = {
  epoch: DEAD_EPOCH,
  storage: 'memory',
  storageHealth: 'ok',
  type: 'leader_ready',
} as const;

const staleResetDone = { epoch: DEAD_EPOCH, type: 'reset_done' } as const;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  harness = createHostHarness();
});

afterEach(async () => {
  await harness.close();
  vi.restoreAllMocks();
});

describe('engine host holding the leadership lock', () => {
  it('ignores the late leader_ready and reset_done of a dead leader while its own engine starts', async () => {
    const coreGate = createGate();
    const host = harness.addHost({
      loadCore: async () => {
        await coreGate.promise;

        return { createEngine };
      },
    });
    await vi.waitFor(() => {
      expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(true);
      expect(harness.lockManager.isHeld(createTabLockName(host.tabId))).toBe(true);
    }, WAIT_OPTIONS);
    const recorded = subscribeRecorded(host, BUYER_CHANNEL, createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1));
    const call = host.organization().listWarehouses({}, buyerOptions);
    await waitForInbox(host, 'subscribe');
    await waitForInbox(host, 'request');
    const foreign = harness.openForeignChannel();

    try {
      foreign.postMessage(staleLeaderReady);
      foreign.postMessage(staleResetDone);
      foreign.postMessage({
        message: { epoch: DEAD_EPOCH, seq: 0n, subscriptionId: readSubscriptionId(host), type: 'subscribed' },
        tabId: host.tabId,
        type: 'relay_to_tab',
      });
      await settleChannels();

      expect(recorded.positions).toEqual([]);
      expect(readStatuses(host)).toEqual([]);
      expect(countMessages(host, 'reset_done')).toBe(0);
      expect(countMessages(host, 'transport_error')).toBe(0);
      expect(countOutboxMessages(host, 'relay_to_leader')).toBe(0);
    }
    finally {
      coreGate.open();
    }

    expect((await call).warehouses).toHaveLength(3);
    await waitForRole(host, 'leader');
    expect(readStatuses(host).map(status => status.role)).toEqual(['leader']);
    expect(readLastStatus(host)?.epoch).not.toBe(DEAD_EPOCH);
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);
    expect(recorded.positions[0]?.epoch).toBe(readLastStatus(host)?.epoch);
    expect(countMessages(host, 'reset_done')).toBe(0);
    expect(countMessages(host, 'transport_error')).toBe(0);
    expect(countOutboxMessages(host, 'relay_to_leader')).toBe(0);
  });

  it('keeps serving its own calls after the late leader_ready and reset_done of a dead leader arrive', async () => {
    const host = harness.addHost();
    await waitForRole(host, 'leader');
    const epoch = readLastStatus(host)?.epoch;
    const foreign = harness.openForeignChannel();
    const received: unknown[] = [];
    foreign.addEventListener('message', (event) => {
      received.push(event.data);
    });

    foreign.postMessage(staleLeaderReady);
    foreign.postMessage(staleResetDone);
    foreign.postMessage({ type: 'leader_query' });
    await vi.waitFor(() => {
      expect(received).toContainEqual(expect.objectContaining({ epoch, type: 'leader_ready' }));
    }, WAIT_OPTIONS);

    expect((await host.organization().listWarehouses({}, buyerOptions)).warehouses).toHaveLength(3);
    expect(readStatuses(host).map(status => status.role)).toEqual(['leader']);
    expect(readLastStatus(host)?.epoch).toBe(epoch);
    expect(countMessages(host, 'reset_done')).toBe(0);
    expect(countOutboxMessages(host, 'relay_to_leader')).toBe(0);
  });
});
