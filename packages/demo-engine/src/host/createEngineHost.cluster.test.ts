import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  organizationChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
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
  readErrorDetail,
} from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import { ENGINE_LOCK_NAME } from './constants';
import {
  createProbeLoader,
  type EngineProbeValue,
} from './testing/engineProbe';
import {
  createHostHarness,
  type HostFixtureValue,
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

const KEY_1 = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const KEY_2 = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';

const CUSTOMER_CHANNEL = organizationChannel(SeedOrganizationId.CUSTOMER_1);
const customerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
const createCustomerHeaders = (): Headers => createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

let harness: HostHarnessValue;

const startPair = async (): Promise<{ follower: HostFixtureValue; leader: HostFixtureValue }> => {
  const leader = harness.addHost();
  await waitForRole(leader, 'leader');
  const follower = harness.addHost();
  await waitForRole(follower, 'follower');

  return { follower, leader };
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  harness = createHostHarness();
});

afterEach(async () => {
  await harness.close();
  vi.restoreAllMocks();
});

describe('engine hosts of two tabs', () => {
  it('elects exactly one leader and tells the other tab the epoch and the storage of the leader', async () => {
    const first = harness.addHost();
    const second = harness.addHost();

    await vi.waitFor(() => {
      expect(readLastStatus(first)).toBeDefined();
      expect(readLastStatus(second)).toBeDefined();
    }, WAIT_OPTIONS);

    const statuses = [readLastStatus(first), readLastStatus(second)];
    expect(statuses.map(status => status?.role).sort()).toEqual(['follower', 'leader']);
    expect(statuses[0]?.epoch).toBe(statuses[1]?.epoch);
    expect(statuses[0]?.storage).toBe('memory');
    expect(harness.lockManager.waitingCount(ENGINE_LOCK_NAME)).toBe(1);
  });

  it('lets a tab opened after the leader find it by asking who the leader is', async () => {
    const { follower, leader } = await startPair();

    expect(readLastStatus(follower)?.epoch).toBe(readLastStatus(leader)?.epoch);
    expect(readStatuses(follower)).toHaveLength(1);
  });

  it('serves a request of the follower by the leader', async () => {
    const { follower } = await startPair();

    const response = await follower.organization().listWarehouses({}, customerOptions);

    expect(response.warehouses).toHaveLength(3);
  });

  it('delivers the permission error for a command of the follower with its detail', async () => {
    const { follower } = await startPair();

    const error = await captureError(follower.organization().createWarehouse(
      createWarehouseRequest(KEY_1),
      callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(error).toBeInstanceOf(ConnectError);
    expect(error.code).toBe(Code.PermissionDenied);
    expect(readErrorDetail(error).code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('delivers the event of a command of the follower to the subscribers of both tabs, one message each', async () => {
    const { follower, leader } = await startPair();
    const leaderRecorded = subscribeRecorded(leader, CUSTOMER_CHANNEL, createCustomerHeaders());
    const followerRecorded = subscribeRecorded(follower, CUSTOMER_CHANNEL, createCustomerHeaders());
    await vi.waitFor(() => {
      expect(leaderRecorded.positions).toHaveLength(1);
      expect(followerRecorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);

    await follower.organization().createWarehouse(createWarehouseRequest(KEY_1), customerOptions);

    await vi.waitFor(() => {
      expect(leaderRecorded.events).toHaveLength(1);
      expect(followerRecorded.events).toHaveLength(1);
    }, WAIT_OPTIONS);
    expect(leaderRecorded.events[0]?.[0]?.payload.case).toBe('warehouseChanged');
    expect(followerRecorded.events[0]?.[0]?.seq).toBe(1n);
    expect(followerRecorded.positions[0]?.epoch).toBe(readLastStatus(leader)?.epoch);
  });

  it('applies the projection of the side: a subscription of the follower to a foreign organization is denied', async () => {
    const { follower } = await startPair();

    const recorded = subscribeRecorded(
      follower,
      organizationChannel(SeedOrganizationId.SUPPLIER_1),
      createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    );

    await vi.waitFor(() => {
      expect(recorded.denied).toHaveLength(1);
    }, WAIT_OPTIONS);
    expect(recorded.denied[0]?.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    expect(recorded.positions).toHaveLength(0);
  });

  it('stops delivering events to a follower subscription after unsubscribe', async () => {
    const { follower, leader } = await startPair();
    const recorded = subscribeRecorded(follower, CUSTOMER_CHANNEL, createCustomerHeaders());
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);

    recorded.unsubscribe();
    await leader.organization().createWarehouse(createWarehouseRequest(KEY_1), customerOptions);
    await follower.organization().listWarehouses({}, customerOptions);

    expect(recorded.events).toHaveLength(0);
    expect(follower.messages.filter(message => message.type === 'events')).toHaveLength(0);
  });

  it('lists the personas for the follower', async () => {
    const { follower } = await startPair();

    expect((await follower.connection.control.listPersonas()).length).toBeGreaterThan(0);
  });

  it('fails a request of the follower with a transport error when the leader does not answer within the timeout', async () => {
    const probes: EngineProbeValue[] = [];
    const leader = harness.addHost({ loadCore: createProbeLoader(probes) });
    await waitForRole(leader, 'leader');
    const follower = harness.addHost();
    await waitForRole(follower, 'follower');
    probes[0]?.holdHandle();

    const failure = captureError(follower.organization().listWarehouses({}, customerOptions));
    await vi.waitFor(() => {
      expect(probes[0]?.handleCount()).toBe(1);
    }, WAIT_OPTIONS);
    harness.timers.advance(10_000);

    expect((await failure).code).toBe(Code.Unavailable);
  });
});

describe('engine hosts when a follower leaves', () => {
  it('removes the subscriptions of a stopped follower from the engine of the leader', async () => {
    const probes: EngineProbeValue[] = [];
    const leader = harness.addHost({ loadCore: createProbeLoader(probes) });
    await waitForRole(leader, 'leader');
    const follower = harness.addHost();
    await waitForRole(follower, 'follower');
    const recorded = subscribeRecorded(follower, CUSTOMER_CHANNEL, createCustomerHeaders());
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);

    expect(probes[0]?.listenerCount(CUSTOMER_CHANNEL)).toBe(1);

    await follower.host.stop();

    await vi.waitFor(() => {
      expect(probes[0]?.listenerCount(CUSTOMER_CHANNEL)).toBe(0);
    }, WAIT_OPTIONS);
  });

  it('removes a subscription of the follower from the engine of the leader on unsubscribe', async () => {
    const probes: EngineProbeValue[] = [];
    const leader = harness.addHost({ loadCore: createProbeLoader(probes) });
    await waitForRole(leader, 'leader');
    const follower = harness.addHost();
    await waitForRole(follower, 'follower');
    const recorded = subscribeRecorded(follower, CUSTOMER_CHANNEL, createCustomerHeaders());
    await vi.waitFor(() => {
      expect(probes[0]?.listenerCount(CUSTOMER_CHANNEL)).toBe(1);
    }, WAIT_OPTIONS);

    recorded.unsubscribe();

    await vi.waitFor(() => {
      expect(probes[0]?.listenerCount(CUSTOMER_CHANNEL)).toBe(0);
    }, WAIT_OPTIONS);
  });
});

describe('engine hosts when the leader leaves', () => {
  it('hands the leadership to the waiting tab with the stored state, a new epoch and restored subscriptions', async () => {
    const { follower, leader } = await startPair();
    const recorded = subscribeRecorded(follower, CUSTOMER_CHANNEL, createCustomerHeaders());
    await follower.organization().createWarehouse(createWarehouseRequest(KEY_1), customerOptions);
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
      expect(recorded.events).toHaveLength(1);
    }, WAIT_OPTIONS);
    const firstEpoch = readLastStatus(leader)?.epoch ?? '';

    await leader.stop();

    const secondEpoch = await waitForStatusEpoch(follower, 'leader', firstEpoch);
    expect(secondEpoch).not.toBe(firstEpoch);
    expect((await follower.organization().listWarehouses({}, customerOptions)).warehouses).toHaveLength(4);
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(2);
    }, WAIT_OPTIONS);
    expect(recorded.positions[1]).toEqual({ epoch: secondEpoch, seq: 1n });

    await follower.organization().createWarehouse(createWarehouseRequest(KEY_2, { name: 'Склад 10' }), customerOptions);
    await vi.waitFor(() => {
      expect(recorded.events).toHaveLength(2);
    }, WAIT_OPTIONS);
    expect(recorded.events[1]?.[0]).toMatchObject({ epoch: secondEpoch, seq: 2n });
  });

  it('fails a request that the departed leader did not finish with a transport error', async () => {
    const probes: EngineProbeValue[] = [];
    const leader = harness.addHost({ loadCore: createProbeLoader(probes) });
    await waitForRole(leader, 'leader');
    const follower = harness.addHost();
    await waitForRole(follower, 'follower');
    probes[0]?.holdHandle();

    const failure = captureError(follower.organization().listWarehouses({}, customerOptions));
    await vi.waitFor(() => {
      expect(probes[0]?.handleCount()).toBe(1);
    }, WAIT_OPTIONS);
    await leader.stop();

    expect((await failure).code).toBe(Code.Unavailable);
    await waitForRole(follower, 'leader');
    expect((await follower.organization().listWarehouses({}, customerOptions)).warehouses).toHaveLength(3);
  });

  it('keeps a third tab as a follower of the new leader and serves its requests', async () => {
    const { follower, leader } = await startPair();
    const third = harness.addHost();
    await waitForRole(third, 'follower');
    const firstEpoch = readLastStatus(leader)?.epoch ?? '';

    await leader.stop();
    const secondEpoch = await waitForStatusEpoch(follower, 'leader', firstEpoch);

    expect(await waitForStatusEpoch(third, 'follower', firstEpoch)).toBe(secondEpoch);
    expect((await third.organization().listWarehouses({}, customerOptions)).warehouses).toHaveLength(3);
  });

  it('closes the leadership cleanly: the final checkpoint is stored before the next leader loads', async () => {
    const { follower, leader } = await startPair();
    harness.realTime.advance(3_000);
    const before = (await harness.storage.load())?.meta.worldTimeMs ?? 0;

    await leader.stop();
    await waitForRole(follower, 'leader');

    expect((await harness.storage.load())?.meta.worldTimeMs).toBe(before + 3_000);
  });
});

describe('engine hosts reset across tabs', () => {
  it('announces the reset to both tabs, re-issues the subscriptions of both and drops the created warehouse', async () => {
    const { follower, leader } = await startPair();
    const created = await follower.organization().createWarehouse(createWarehouseRequest(KEY_1), customerOptions);
    const warehouseId = created.warehouse?.id ?? '';
    const leaderOrganization = subscribeRecorded(leader, CUSTOMER_CHANNEL, createCustomerHeaders());
    const followerOrganization = subscribeRecorded(follower, CUSTOMER_CHANNEL, createCustomerHeaders());
    const followerWarehouse = subscribeRecorded(follower, warehouseChannel(warehouseId), createCustomerHeaders());
    const leaderResets: string[] = [];
    const followerResets: string[] = [];
    leader.connection.control.onReset((epoch) => {
      leaderResets.push(epoch);
    });
    follower.connection.control.onReset((epoch) => {
      followerResets.push(epoch);
    });
    await vi.waitFor(() => {
      expect(leaderOrganization.positions).toHaveLength(1);
      expect(followerOrganization.positions).toHaveLength(1);
      expect(followerWarehouse.positions).toHaveLength(1);
    }, WAIT_OPTIONS);
    const epochBefore = readLastStatus(leader)?.epoch;

    await follower.connection.control.reset();

    await vi.waitFor(() => {
      expect(leaderResets).toHaveLength(1);
      expect(followerResets).toHaveLength(1);
      expect(leaderOrganization.positions).toHaveLength(2);
      expect(followerOrganization.positions).toHaveLength(2);
      expect(followerWarehouse.denied).toHaveLength(1);
    }, WAIT_OPTIONS);
    const epochAfter = leaderResets[0];
    expect(epochAfter).not.toBe(epochBefore);
    expect(followerResets).toEqual([epochAfter]);
    expect(leaderOrganization.positions[1]).toEqual({ epoch: epochAfter, seq: 0n });
    expect(followerOrganization.positions[1]).toEqual({ epoch: epochAfter, seq: 0n });
    expect(readLastStatus(leader)?.epoch).toBe(epochAfter);
    expect(readLastStatus(follower)).toEqual({
      coordination: 'shared',
      epoch: epochAfter,
      role: 'follower',
      storage: 'memory',
      storageHealth: 'ok',
    });
    expect((await follower.organization().listWarehouses({}, customerOptions)).warehouses).toHaveLength(3);
  });
});

describe('engine hosts when the tab of the leader is killed without stopping', () => {
  it('hands the leadership to the first waiting tab, fails what the dead leader held and restores the other subscriptions', async () => {
    const probesOfLeader: EngineProbeValue[] = [];
    const probesOfSuccessor: EngineProbeValue[] = [];
    const successorCoreGate = createGate();
    const loadSuccessorProbe = createProbeLoader(probesOfSuccessor);
    let successorLoadCount = 0;

    const leader = harness.addHost({ loadCore: createProbeLoader(probesOfLeader) });
    await waitForRole(leader, 'leader');
    const successor = harness.addHost({
      loadCore: async () => {
        successorLoadCount += 1;
        await successorCoreGate.promise;

        return loadSuccessorProbe();
      },
    });
    await waitForRole(successor, 'follower');
    const bystander = harness.addHost();
    await waitForRole(bystander, 'follower');
    await bystander.organization().createWarehouse(createWarehouseRequest(KEY_1), customerOptions);
    const successorRecorded = subscribeRecorded(successor, CUSTOMER_CHANNEL, createCustomerHeaders());
    const bystanderRecorded = subscribeRecorded(bystander, CUSTOMER_CHANNEL, createCustomerHeaders());
    await vi.waitFor(() => {
      expect(successorRecorded.positions).toHaveLength(1);
      expect(bystanderRecorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);
    const handleCountBefore = probesOfLeader[0]?.handleCount() ?? 0;
    probesOfLeader[0]?.holdHandle();
    const successorCall = captureError(successor.organization().listWarehouses({}, customerOptions));
    const bystanderCall = captureError(bystander.organization().listWarehouses({}, customerOptions));
    await vi.waitFor(() => {
      expect(probesOfLeader[0]?.handleCount()).toBe(handleCountBefore + 2);
    }, WAIT_OPTIONS);
    const firstEpoch = readLastStatus(leader)?.epoch ?? '';
    const leaderOutboxLength = leader.channelOutbox().length;

    leader.kill();

    await vi.waitFor(() => {
      expect(successorLoadCount).toBe(1);
    }, WAIT_OPTIONS);
    const callDuringStartup = successor.organization().listWarehouses({}, customerOptions);
    await waitForInbox(successor, 'request', 2);
    successorCoreGate.open();

    expect((await successorCall).code).toBe(Code.Unavailable);
    expect((await bystanderCall).code).toBe(Code.Unavailable);
    const secondEpoch = await waitForStatusEpoch(successor, 'leader', firstEpoch);
    expect(secondEpoch).not.toBe(firstEpoch);
    expect((await callDuringStartup).warehouses).toHaveLength(4);
    expect(await waitForStatusEpoch(bystander, 'follower', firstEpoch)).toBe(secondEpoch);
    await vi.waitFor(() => {
      expect(successorRecorded.positions).toHaveLength(2);
      expect(bystanderRecorded.positions).toHaveLength(2);
    }, WAIT_OPTIONS);
    expect(successorRecorded.positions[1]?.epoch).toBe(secondEpoch);
    expect(bystanderRecorded.positions[1]?.epoch).toBe(secondEpoch);
    expect(probesOfSuccessor[0]?.listenerCount(CUSTOMER_CHANNEL)).toBe(2);

    await successor.organization().createWarehouse(createWarehouseRequest(KEY_2, { name: 'Склад 10' }), customerOptions);

    await vi.waitFor(() => {
      expect(successorRecorded.events).toHaveLength(1);
      expect(bystanderRecorded.events).toHaveLength(1);
    }, WAIT_OPTIONS);
    expect(successorRecorded.events[0]?.[0]?.epoch).toBe(secondEpoch);
    expect(bystanderRecorded.events[0]?.[0]?.epoch).toBe(secondEpoch);
    expect(leader.channelOutbox()).toHaveLength(leaderOutboxLength);
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(true);
  });
});
