import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { FakeIndexedDbStorageValue } from './testing/fakeIndexedDbStorage';
import type {
  HostFixtureValue,
  HostHarnessValue,
} from './testing/hostHarness';

import { createWarehouseRequest } from '../core/engine/testing/engineHarness';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import { CHECKPOINT_INTERVAL_MS } from './constants';
import { createFakeIndexedDbStorage } from './testing/fakeIndexedDbStorage';
import {
  createHostHarness,
  readLastStatus,
  readStatuses,
} from './testing/hostHarness';
import {
  WAIT_OPTIONS,
  waitForRole,
} from './testing/hostScenario';

const KEY_1 = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const KEY_2 = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const HEALTH_LOG_LABEL = '> EngineHost -> storageHealth:';
const WRITE_ERROR = new Error('The quota is exceeded');

const buyerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);

let harness: HostHarnessValue;
let storage: FakeIndexedDbStorageValue;

const addHost = (): HostFixtureValue => harness.addHost({
  openStorage: () => Promise.resolve({ kind: 'indexed-db', storage }),
});

const startPair = async (): Promise<{ follower: HostFixtureValue; leader: HostFixtureValue }> => {
  const leader = addHost();
  await waitForRole(leader, 'leader');
  const follower = addHost();
  await waitForRole(follower, 'follower');

  return { follower, leader };
};

const readHealths = (fixture: HostFixtureValue): string[] => readStatuses(fixture).map(status => status.storageHealth);

const readHealthLogs = (): unknown[][] => vi.mocked(console.log).mock.calls.filter(call => call[0] === HEALTH_LOG_LABEL);

const waitForHealth = async (fixture: HostFixtureValue, health: 'failing' | 'ok'): Promise<void> => {
  await vi.waitFor(() => {
    expect(readLastStatus(fixture)?.storageHealth).toBe(health);
  }, WAIT_OPTIONS);
};

const runCheckpointWithChange = async (): Promise<void> => {
  const attemptsBefore = storage.writeAttemptCount();
  harness.realTime.advance(1_000);
  harness.timers.advance(CHECKPOINT_INTERVAL_MS);
  await vi.waitFor(() => {
    expect(storage.writeAttemptCount()).toBeGreaterThan(attemptsBefore);
  }, WAIT_OPTIONS);
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  harness = createHostHarness();
  storage = createFakeIndexedDbStorage();
});

afterEach(async () => {
  await harness.close();
  vi.restoreAllMocks();
});

describe('storage health of the engine host', () => {
  it('starts healthy with a shared coordination and the IndexedDB storage', async () => {
    const leader = addHost();
    await waitForRole(leader, 'leader');

    expect(readStatuses(leader)).toEqual([
      {
        coordination: 'shared',
        epoch: readLastStatus(leader)?.epoch,
        role: 'leader',
        storage: 'indexed-db',
        storageHealth: 'ok',
      },
    ]);
    expect(readHealthLogs()).toEqual([]);
  });

  it('answers a command with unavailable and tells the leader and the follower once that the storage is failing', async () => {
    const { follower, leader } = await startPair();
    storage.failWrites(WRITE_ERROR);

    const error = await captureError(leader.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions));
    const followerError = await captureError(follower.organization().createWarehouse(createWarehouseRequest(KEY_2), buyerOptions));

    expect(error).toBeInstanceOf(ConnectError);
    expect(error.code).toBe(Code.Unavailable);
    expect(readErrorDetail(error).code).toBe(ErrorCode.UNAVAILABLE);
    expect(followerError.code).toBe(Code.Unavailable);
    await waitForHealth(leader, 'failing');
    await waitForHealth(follower, 'failing');
    expect(readHealths(leader)).toEqual(['ok', 'failing']);
    expect(readHealths(follower)).toEqual(['ok', 'failing']);
    expect(readLastStatus(follower)).toMatchObject({ coordination: 'shared', role: 'follower' });
  });

  it('logs only the change of the state with the new state and the error', async () => {
    const { leader } = await startPair();
    storage.failWrites(WRITE_ERROR);

    await captureError(leader.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions));
    await captureError(leader.organization().createWarehouse(createWarehouseRequest(KEY_2), buyerOptions));

    expect(readHealthLogs()).toEqual([[HEALTH_LOG_LABEL, { error: WRITE_ERROR, health: 'failing' }]]);
  });

  it('does not repeat the status or the log on every failing checkpoint', async () => {
    const { follower, leader } = await startPair();
    storage.failWrites(WRITE_ERROR);

    await runCheckpointWithChange();
    await waitForHealth(leader, 'failing');
    await waitForHealth(follower, 'failing');
    await runCheckpointWithChange();
    await runCheckpointWithChange();
    await runCheckpointWithChange();

    expect(readHealths(leader)).toEqual(['ok', 'failing']);
    expect(readHealths(follower)).toEqual(['ok', 'failing']);
    expect(readHealthLogs()).toHaveLength(1);
  });

  it('turns ok again for both tabs after the next successful write and logs that change once', async () => {
    const { follower, leader } = await startPair();
    storage.failWrites(WRITE_ERROR);
    await captureError(leader.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions));
    await waitForHealth(follower, 'failing');
    storage.failWrites(undefined);

    const response = await leader.organization().createWarehouse(createWarehouseRequest(KEY_2), buyerOptions);
    await runCheckpointWithChange();

    expect(response.warehouse).toBeDefined();
    await waitForHealth(leader, 'ok');
    await waitForHealth(follower, 'ok');
    expect(readHealths(leader)).toEqual(['ok', 'failing', 'ok']);
    expect(readHealths(follower)).toEqual(['ok', 'failing', 'ok']);
    expect(readHealthLogs().map(call => call[1])).toEqual([
      { error: WRITE_ERROR, health: 'failing' },
      { error: undefined, health: 'ok' },
    ]);
  });

  it('turns failing when a checkpoint cannot write and keeps the timers running', async () => {
    const leader = addHost();
    await waitForRole(leader, 'leader');
    storage.failWrites(WRITE_ERROR);

    await runCheckpointWithChange();

    await waitForHealth(leader, 'failing');
    storage.failWrites(undefined);
    await runCheckpointWithChange();
    await waitForHealth(leader, 'ok');
  });

  it('tells a tab opened later that the storage is failing in its first status', async () => {
    const leader = addHost();
    await waitForRole(leader, 'leader');
    storage.failWrites(WRITE_ERROR);
    await captureError(leader.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions));
    await waitForHealth(leader, 'failing');

    const late = addHost();
    await waitForRole(late, 'follower');

    expect(readHealths(late)).toEqual(['failing']);
  });
});
