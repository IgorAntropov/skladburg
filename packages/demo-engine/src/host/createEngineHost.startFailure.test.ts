import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { HostHarnessValue } from './testing/hostHarness';

import { createHeaders } from '../core/engine/testing/engineHarness';
import { callAs } from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import { ENGINE_LOCK_NAME } from './constants';
import {
  createHostHarness,
  readLastStatus,
  readStatuses,
} from './testing/hostHarness';
import {
  createGate,
  WAIT_OPTIONS,
  waitForInbox,
  waitForRole,
  waitForStatusEpoch,
} from './testing/hostScenario';
import { subscribeRecorded } from './testing/recordedSubscription';

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

describe('engine hosts when the start of the leader fails', () => {
  it('returns the tab to the followers of the next leader and serves its calls and subscription', async () => {
    const loadGate = createGate();
    const failed = harness.addHost({
      loadCore: async () => {
        await loadGate.promise;

        throw new Error('The engine core is not loaded');
      },
    });
    const successor = harness.addHost();
    const callBeforeFailure = failed.organization().listWarehouses({}, buyerOptions);
    const recorded = subscribeRecorded(
      failed,
      BUYER_CHANNEL,
      createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1),
    );
    await waitForInbox(failed, 'request');
    await waitForInbox(failed, 'subscribe');

    loadGate.open();

    const epoch = await waitForStatusEpoch(failed, 'follower');
    expect(readLastStatus(failed)).toMatchObject({ coordination: 'shared', role: 'follower' });
    await waitForRole(successor, 'leader');
    expect(readLastStatus(successor)?.epoch).toBe(epoch);
    expect((await callBeforeFailure).warehouses).toHaveLength(3);
    expect((await failed.organization().listWarehouses({}, buyerOptions)).warehouses).toHaveLength(3);
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);
    expect(recorded.positions[0]?.epoch).toBe(epoch);
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(true);
  });

  it('tells the tab that the engine is unavailable before the status of the next leader', async () => {
    const failed = harness.addHost({ loadCore: () => Promise.reject(new Error('The engine core is not loaded')) });
    const successor = harness.addHost();

    await waitForRole(successor, 'leader');
    await waitForRole(failed, 'follower');

    expect(failed.messages.map(message => message.type)).toEqual(['engine_unavailable', 'status']);
    expect(failed.messages[0]).toEqual({ reason: 'start_failed', type: 'engine_unavailable' });
    expect(readStatuses(failed)).toHaveLength(1);
    expect(readStatuses(successor)).toHaveLength(1);
  });
});
