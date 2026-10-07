import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { EngineProbeValue } from './testing/engineProbe';
import type { HostHarnessValue } from './testing/hostHarness';

import {
  createHeaders,
  createWarehouseRequest,
} from '../core/engine/testing/engineHarness';
import { callAs } from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import { createTabLockName } from './constants';
import { createProbeLoader } from './testing/engineProbe';
import {
  createHostHarness,
  type HostFixtureValue,
  readLastStatus,
} from './testing/hostHarness';
import {
  countOutboxMessages,
  WAIT_OPTIONS,
  waitForRole,
  waitForStatusEpoch,
} from './testing/hostScenario';
import { subscribeRecorded } from './testing/recordedSubscription';

const KEY_1 = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const LATE_TAB_ID = 'tab-late';
const BUYER_CHANNEL = organizationChannel(SeedOrganizationId.BUYER_1);
const buyerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);
const createBuyerHeaders = (): Headers => createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);
const DROP_LOG_NAME = '> EngineHost -> dropTab:';
const TAB_LOCK_LOG_NAMES = [DROP_LOG_NAME, '> EngineHost -> watchTab:', '> EngineHost -> requestTabLock:'];

let harness: HostHarnessValue;

const readTabLockLogs = (): unknown[][] => vi.mocked(console.log).mock.calls
  .filter(call => TAB_LOCK_LOG_NAMES.includes(String(call[0])));

const startTriple = async (): Promise<{
  bystander: HostFixtureValue;
  leader: HostFixtureValue;
  leaderProbes: EngineProbeValue[];
  leaver: HostFixtureValue;
}> => {
  const leaderProbes: EngineProbeValue[] = [];
  const leader = harness.addHost({ loadCore: createProbeLoader(leaderProbes) });
  await waitForRole(leader, 'leader');
  const bystander = harness.addHost();
  await waitForRole(bystander, 'follower');
  const leaver = harness.addHost();
  await waitForRole(leaver, 'follower');

  return { bystander, leader, leaderProbes, leaver };
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  harness = createHostHarness();
});

afterEach(async () => {
  await harness.close();
  vi.restoreAllMocks();
});

describe('engine hosts holding the lock of their tab', () => {
  it('drops the subscriptions of a killed tab at the leader and leaves the subscriptions of the living tab alone', async () => {
    const { bystander, leader, leaderProbes, leaver } = await startTriple();
    const bystanderRecorded = subscribeRecorded(bystander, BUYER_CHANNEL, createBuyerHeaders());
    subscribeRecorded(leaver, BUYER_CHANNEL, createBuyerHeaders());
    await vi.waitFor(() => {
      expect(leaderProbes[0]?.listenerCount(BUYER_CHANNEL)).toBe(2);
    }, WAIT_OPTIONS);
    expect(harness.lockManager.waitingCount(createTabLockName(leaver.tabId))).toBe(1);

    leaver.kill();

    await vi.waitFor(() => {
      expect(leaderProbes[0]?.listenerCount(BUYER_CHANNEL)).toBe(1);
    }, WAIT_OPTIONS);
    expect(harness.lockManager.waitingCount(createTabLockName(leaver.tabId))).toBe(0);
    expect(readTabLockLogs()).toEqual([[DROP_LOG_NAME, {
      abortedCallCount: 0,
      droppedSubscriptionCount: 1,
      tabId: leaver.tabId,
    }]]);

    const relaysToKilledTab = countOutboxMessages(leader, 'relay_to_tab', leaver.tabId);
    await bystander.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);

    await vi.waitFor(() => {
      expect(bystanderRecorded.events).toHaveLength(1);
    }, WAIT_OPTIONS);
    expect(countOutboxMessages(leader, 'relay_to_tab', leaver.tabId)).toBe(relaysToKilledTab);
    expect(leaderProbes[0]?.listenerCount(BUYER_CHANNEL)).toBe(1);
  });

  it('lets the leader stop waiting for a follower that stopped cleanly, without any error log', async () => {
    const { leaderProbes, leaver } = await startTriple();
    subscribeRecorded(leaver, BUYER_CHANNEL, createBuyerHeaders());
    await vi.waitFor(() => {
      expect(leaderProbes[0]?.listenerCount(BUYER_CHANNEL)).toBe(1);
    }, WAIT_OPTIONS);
    expect(harness.lockManager.waitingCount(createTabLockName(leaver.tabId))).toBe(1);

    await leaver.stop();

    await vi.waitFor(() => {
      expect(harness.lockManager.waitingCount(createTabLockName(leaver.tabId))).toBe(0);
      expect(leaderProbes[0]?.listenerCount(BUYER_CHANNEL)).toBe(0);
      expect(harness.lockManager.isHeld(createTabLockName(leaver.tabId))).toBe(false);
    }, WAIT_OPTIONS);
    expect(readTabLockLogs().filter(call => call[0] !== DROP_LOG_NAME)).toEqual([]);
    expect(readTabLockLogs().length).toBeLessThanOrEqual(1);
  });

  it('cancels the waits of the leader for foreign tab locks when the leader stops', async () => {
    const { bystander, leader, leaderProbes } = await startTriple();
    subscribeRecorded(bystander, BUYER_CHANNEL, createBuyerHeaders());
    await vi.waitFor(() => {
      expect(leaderProbes[0]?.listenerCount(BUYER_CHANNEL)).toBe(1);
    }, WAIT_OPTIONS);
    expect(harness.lockManager.waitingCount(createTabLockName(bystander.tabId))).toBe(1);

    await leader.stop();

    expect(harness.lockManager.waitingCount(createTabLockName(bystander.tabId))).toBe(0);
    expect(readTabLockLogs()).toEqual([]);
  });

  it('lets the new leader wait for the lock of a tab again once that tab re-subscribes', async () => {
    const { bystander, leader, leaver } = await startTriple();
    subscribeRecorded(leaver, BUYER_CHANNEL, createBuyerHeaders());
    const firstEpoch = readLastStatus(leader)?.epoch ?? '';
    await vi.waitFor(() => {
      expect(harness.lockManager.waitingCount(createTabLockName(leaver.tabId))).toBe(1);
    }, WAIT_OPTIONS);

    await leader.stop();
    await waitForStatusEpoch(bystander, 'leader', firstEpoch);

    await vi.waitFor(() => {
      expect(harness.lockManager.waitingCount(createTabLockName(leaver.tabId))).toBe(1);
    }, WAIT_OPTIONS);
  });

  it('sends nothing to the leader before the lock of its own tab is granted, then everything', async () => {
    const releaseTabLock = harness.lockManager.occupy(createTabLockName(LATE_TAB_ID));
    const { leader, leaderProbes } = await startTriple();
    const late = harness.addHost({ tabId: LATE_TAB_ID });
    const recorded = subscribeRecorded(late, BUYER_CHANNEL, createBuyerHeaders());
    const call = late.organization().listWarehouses({}, buyerOptions);
    const other = harness.addHost();
    await waitForRole(other, 'follower');

    expect(readLastStatus(late)).toBeUndefined();
    expect(countOutboxMessages(late, 'relay_to_leader')).toBe(0);
    expect(countOutboxMessages(late, 'leader_query')).toBe(0);
    expect(harness.lockManager.waitingCount(createTabLockName(LATE_TAB_ID))).toBe(1);
    expect(leaderProbes[0]?.listenerCount(BUYER_CHANNEL)).toBe(0);

    releaseTabLock();

    expect((await call).warehouses).toHaveLength(3);
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);
    expect(readLastStatus(late)?.role).toBe('follower');
    expect(readLastStatus(late)?.epoch).toBe(readLastStatus(leader)?.epoch);
    expect(countOutboxMessages(late, 'relay_to_leader')).toBeGreaterThan(0);
    expect(leaderProbes[0]?.listenerCount(BUYER_CHANNEL)).toBe(1);
  });

  it('does not request the lock of its tab in the single-tab mode', async () => {
    const single = harness.addHost({ isSingleTab: true });
    await waitForRole(single, 'leader');

    expect(harness.lockManager.requestedNames()).toEqual([]);
    expect(readLastStatus(single)?.coordination).toBe('single-tab');
  });

  it('requests the lock of its tab and the leadership lock in the shared mode', async () => {
    const shared = harness.addHost();
    await waitForRole(shared, 'leader');

    expect(harness.lockManager.requestedNames()).toContain(createTabLockName(shared.tabId));
    expect(harness.lockManager.isHeld(createTabLockName(shared.tabId))).toBe(true);
  });
});
