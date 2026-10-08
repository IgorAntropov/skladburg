import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  HostFixtureValue,
  HostHarnessValue,
} from './testing/hostHarness';

import { createEngine } from '../core/engine/createEngine';
import {
  ENGINE_LOCK_NAME,
  LEADER_RETRY_DELAYS_MS,
  LEADER_RETRY_REPEAT_DELAY_MS,
} from './constants';
import {
  countMessages,
  createHostHarness,
  readLastStatus,
} from './testing/hostHarness';
import {
  createGate,
  settleChannels,
  WAIT_OPTIONS,
  waitForRole,
  waitForStatusEpoch,
} from './testing/hostScenario';

interface FlakyCoreValue {
  loadCore: () => Promise<{ createEngine: typeof createEngine }>;
  loadCount: () => number;
}

let harness: HostHarnessValue;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  harness = createHostHarness();
});

afterEach(async () => {
  await harness.close();
  vi.restoreAllMocks();
});

const createFlakyCore = (failureCount: number): FlakyCoreValue => {
  let loads = 0;

  return {
    loadCore: () => {
      loads += 1;

      return loads <= failureCount
        ? Promise.reject(new Error('The engine core is not loaded'))
        : Promise.resolve({ createEngine });
    },
    loadCount: () => loads,
  };
};

const countLeaderLockRequests = (): number =>
  harness.lockManager.requestedNames().filter(name => name === ENGINE_LOCK_NAME).length;

const waitForUnavailableCount = (fixture: HostFixtureValue, count: number): Promise<void> =>
  vi.waitFor(() => {
    expect(countMessages(fixture, 'engine_unavailable')).toBe(count);
  }, WAIT_OPTIONS);

const startFailedHostFollowingLeader = async (failureCount: number): Promise<{
  failed: HostFixtureValue;
  failedCore: FlakyCoreValue;
  leader: HostFixtureValue;
}> => {
  const failedCore = createFlakyCore(failureCount);
  const failed = harness.addHost({ loadCore: failedCore.loadCore });
  await waitForUnavailableCount(failed, 1);

  const leader = harness.addHost();
  await waitForRole(leader, 'leader');
  await waitForRole(failed, 'follower');
  await vi.waitFor(() => {
    expect(harness.lockManager.waitingCount(ENGINE_LOCK_NAME)).toBe(1);
  }, WAIT_OPTIONS);

  return { failed, failedCore, leader };
};

describe('engine host of a shared tab after a failed start of the leader', () => {
  it('queues for the leader lock at once when it sees the leader of another tab, without waiting for the pause', async () => {
    const { failedCore } = await startFailedHostFollowingLeader(1);

    expect(failedCore.loadCount()).toBe(1);
    expect(countLeaderLockRequests()).toBe(3);
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(true);
  });

  it('takes the lock when the leader disappears without leader_gone and reports the status of its own epoch', async () => {
    const { failed, failedCore, leader } = await startFailedHostFollowingLeader(1);
    const deadEpoch = readLastStatus(leader)?.epoch ?? '';

    leader.kill();

    const epoch = await waitForStatusEpoch(failed, 'leader', deadEpoch);
    expect(epoch).not.toBe(deadEpoch);
    expect(readLastStatus(failed)).toMatchObject({ coordination: 'shared', role: 'leader' });
    expect(failedCore.loadCount()).toBe(2);
    expect(countMessages(failed, 'engine_unavailable')).toBe(1);
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(true);
    expect(harness.lockManager.waitingCount(ENGINE_LOCK_NAME)).toBe(0);
  });

  it('reports engine_unavailable again and queues for the pause when the retry after the leader disappears fails too', async () => {
    const { failed, failedCore, leader } = await startFailedHostFollowingLeader(2);

    leader.kill();

    await waitForUnavailableCount(failed, 2);
    expect(failedCore.loadCount()).toBe(2);

    harness.timers.advance(LEADER_RETRY_DELAYS_MS[1] - 1);
    await settleChannels();
    expect(failedCore.loadCount()).toBe(2);

    harness.timers.advance(1);
    await waitForStatusEpoch(failed, 'leader');
    expect(failedCore.loadCount()).toBe(3);
  });

  it('retries the start after the pause when no other leader appears', async () => {
    const failedCore = createFlakyCore(1);
    const failed = harness.addHost({ loadCore: failedCore.loadCore });
    await waitForUnavailableCount(failed, 1);

    harness.timers.advance(LEADER_RETRY_DELAYS_MS[0] - 1);
    await settleChannels();
    expect(failedCore.loadCount()).toBe(1);
    expect(readLastStatus(failed)).toBeUndefined();

    harness.timers.advance(1);

    await waitForRole(failed, 'leader');
    expect(failedCore.loadCount()).toBe(2);
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(true);
  });

  it('makes at most one attempt per pause and lengthens the pauses 1, 5, 15, 30 and then 30 seconds', async () => {
    const failedCore = createFlakyCore(Number.POSITIVE_INFINITY);
    const failed = harness.addHost({ loadCore: failedCore.loadCore });
    await waitForUnavailableCount(failed, 1);
    const delays = [...LEADER_RETRY_DELAYS_MS, LEADER_RETRY_REPEAT_DELAY_MS, LEADER_RETRY_REPEAT_DELAY_MS];

    expect(delays).toEqual([1000, 5000, 15_000, 30_000, 30_000, 30_000]);

    for (const [index, delayMs] of delays.entries()) {
      harness.timers.advance(delayMs - 1);
      await settleChannels();
      expect(failedCore.loadCount()).toBe(index + 1);
      expect(countLeaderLockRequests()).toBe(index + 1);

      harness.timers.advance(1);
      await waitForUnavailableCount(failed, index + 2);
      expect(failedCore.loadCount()).toBe(index + 2);
    }

    harness.timers.advance(10 * LEADER_RETRY_REPEAT_DELAY_MS - 1);
    await settleChannels();
    expect(failedCore.loadCount()).toBe(delays.length + 2);
    expect(readLastStatus(failed)).toBeUndefined();
  });

  it('cancels the retry timer on stop', async () => {
    const failedCore = createFlakyCore(1);
    const failed = harness.addHost({ loadCore: failedCore.loadCore });
    await waitForUnavailableCount(failed, 1);
    const activeTimersBefore = harness.timers.activeCount();

    await failed.stop();

    expect(harness.timers.activeCount()).toBe(activeTimersBefore - 1);

    harness.timers.advance(10 * LEADER_RETRY_REPEAT_DELAY_MS);
    await settleChannels();
    expect(failedCore.loadCount()).toBe(1);
    expect(countLeaderLockRequests()).toBe(1);
  });

  it('does not arm the retry timer when the start fails after stop was called', async () => {
    const loadGate = createGate();
    let loads = 0;
    const activeTimersBefore = harness.timers.activeCount();
    const host = harness.addHost({
      loadCore: async () => {
        loads += 1;
        await loadGate.promise;

        throw new Error('The engine core is not loaded');
      },
    });
    await vi.waitFor(() => {
      expect(loads).toBe(1);
    }, WAIT_OPTIONS);

    const stopped = host.stop();
    loadGate.open();
    await stopped;

    expect(harness.timers.activeCount()).toBe(activeTimersBefore);

    harness.timers.advance(10 * LEADER_RETRY_REPEAT_DELAY_MS);
    await settleChannels();
    expect(loads).toBe(1);
    expect(countLeaderLockRequests()).toBe(1);
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(false);
  });

  it('cancels the queued lock request on stop', async () => {
    const { failed, failedCore, leader } = await startFailedHostFollowingLeader(1);

    await failed.stop();

    expect(harness.lockManager.waitingCount(ENGINE_LOCK_NAME)).toBe(0);

    leader.kill();
    await settleChannels();
    expect(failedCore.loadCount()).toBe(1);
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(false);
  });
});
