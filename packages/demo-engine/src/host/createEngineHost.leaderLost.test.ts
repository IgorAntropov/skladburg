import { organizationChannel } from '@skladburg/contracts/runtime';
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
import type { GateValue } from './testing/hostScenario';

import { createEngine } from '../core/engine/createEngine';
import { createHeaders } from '../core/engine/testing/engineHarness';
import { callAs } from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
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
  waitForStatusEpoch,
} from './testing/hostScenario';
import { subscribeRecorded } from './testing/recordedSubscription';

const BUYER_CHANNEL = organizationChannel(SeedOrganizationId.BUYER_1);
const buyerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);

let harness: HostHarnessValue;
let successorGate: GateValue | undefined;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  harness = createHostHarness();
});

afterEach(async () => {
  successorGate?.open();
  successorGate = undefined;
  await harness.close();
  vi.restoreAllMocks();
});

const startKilledLeaderWithGatedSuccessor = async (): Promise<{
  bystander: HostFixtureValue;
  deadEpoch: string;
  openSuccessorCore: () => void;
  successor: HostFixtureValue;
}> => {
  const successorCoreGate = createGate();
  successorGate = successorCoreGate;
  let successorLoadCount = 0;

  const leader = harness.addHost();
  await waitForRole(leader, 'leader');
  const successor = harness.addHost({
    loadCore: async () => {
      successorLoadCount += 1;
      await successorCoreGate.promise;

      return { createEngine };
    },
  });
  await waitForRole(successor, 'follower');
  const bystander = harness.addHost();
  await waitForRole(bystander, 'follower');
  const deadEpoch = readLastStatus(leader)?.epoch ?? '';

  leader.kill();
  await vi.waitFor(() => {
    expect(successorLoadCount).toBe(1);
  }, WAIT_OPTIONS);
  await settleChannels();

  return { bystander, deadEpoch, openSuccessorCore: successorCoreGate.open, successor };
};

describe('engine hosts when a new leader takes the lock and starts its engine', () => {
  it('queues the call of a follower sent in the startup window for the new leader instead of failing it', async () => {
    const { bystander, openSuccessorCore } = await startKilledLeaderWithGatedSuccessor();

    const call = bystander.organization().listWarehouses({}, buyerOptions);
    await waitForInbox(bystander, 'request');
    await settleChannels();

    expect(countOutboxMessages(bystander, 'relay_to_leader')).toBe(0);

    openSuccessorCore();

    expect((await call).warehouses).toHaveLength(3);
    expect(countMessages(bystander, 'transport_error')).toBe(0);
  });

  it('ignores the late leader_ready, reset_done and relayed messages of the dead leader in the startup window', async () => {
    const { bystander, deadEpoch, openSuccessorCore, successor } = await startKilledLeaderWithGatedSuccessor();
    const recorded = subscribeRecorded(
      bystander,
      BUYER_CHANNEL,
      createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1),
    );
    await waitForInbox(bystander, 'subscribe');
    await settleChannels();
    const statusesBefore = readStatuses(bystander).length;
    const foreign = harness.openForeignChannel();

    foreign.postMessage({ epoch: deadEpoch, storage: 'memory', storageHealth: 'ok', type: 'leader_ready' });
    foreign.postMessage({ epoch: deadEpoch, type: 'reset_done' });
    foreign.postMessage({
      message: { epoch: deadEpoch, seq: 0n, subscriptionId: readSubscriptionId(bystander), type: 'subscribed' },
      tabId: bystander.tabId,
      type: 'relay_to_tab',
    });
    await settleChannels();

    expect(readStatuses(bystander)).toHaveLength(statusesBefore);
    expect(countMessages(bystander, 'reset_done')).toBe(0);
    expect(recorded.positions).toEqual([]);
    expect(countOutboxMessages(bystander, 'relay_to_leader')).toBe(0);

    openSuccessorCore();

    await waitForRole(successor, 'leader');
    const newEpoch = await waitForStatusEpoch(bystander, 'follower', deadEpoch);
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);
    expect(recorded.positions[0]?.epoch).toBe(newEpoch);
    expect(countMessages(bystander, 'reset_done')).toBe(0);
    expect(countMessages(bystander, 'transport_error')).toBe(0);
  });
});
