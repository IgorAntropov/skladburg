import { create } from '@bufbuild/protobuf';
import {
  createClient,
  type Transport,
} from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import {
  CreateWarehouseRequestSchema,
  OrganizationService,
  WarehouseCapability,
} from '@skladburg/contracts/organization/v1/organization';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { InProcessEngineValue } from './createInProcessEngineConnection';

import { createSpyStorage } from '../core/engine/testing/engineHarness';
import { callAs } from '../core/modules/testing/moduleHarness';
import {
  SeedBoardNodeId,
  SeedCityId,
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import {
  CHECKPOINT_INTERVAL_MS,
  TICK_INTERVAL_MS,
} from '../host/index';
import { WAIT_OPTIONS } from '../host/testing/hostScenario';
import { ENGINE_BASE_URL } from '../protocol/index';
import { createInProcessEngineConnection } from './createInProcessEngineConnection';

const COMMAND_KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const CUSTOMER_CHANNEL = organizationChannel(SeedOrganizationId.CUSTOMER_1);
const customerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

let engine: InProcessEngineValue | undefined;

const openEngine = (...args: Parameters<typeof createInProcessEngineConnection>): InProcessEngineValue => {
  const opened = createInProcessEngineConnection(...args);
  engine = opened;

  return opened;
};

const createOrganizationClient = (opened: InProcessEngineValue): ReturnType<typeof createClient<typeof OrganizationService>> => {
  const transport: Transport = createConnectTransport({
    baseUrl: ENGINE_BASE_URL,
    fetch: opened.connection.fetch,
    useBinaryFormat: true,
  });

  return createClient(OrganizationService, transport);
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(async () => {
  await engine?.close();
  engine = undefined;
  vi.restoreAllMocks();
});

describe('in-process engine connection', () => {
  it('answers the warehouses of the first customer through the Connect client', async () => {
    const opened = openEngine();

    const response = await createOrganizationClient(opened).listWarehouses({}, customerOptions);

    expect(response.warehouses).toHaveLength(3);
  });

  it('delivers the event of a command to a subscriber of the organization channel', async () => {
    const opened = openEngine();
    const received: (string | undefined)[] = [];
    opened.connection.subscribe(
      CUSTOMER_CHANNEL,
      new Headers(customerOptions.headers),
      {
        onDenied: () => undefined,
        onEvents: (events) => {
          received.push(...events.map(event => event.payload.case));
        },
        onSubscribed: () => undefined,
      },
    );

    await createOrganizationClient(opened).createWarehouse(create(CreateWarehouseRequestSchema, {
      address: 'ул. Вымышленная, 1',
      boardNodeId: SeedBoardNodeId.KAZAN,
      capabilities: [WarehouseCapability.RAMP],
      cityId: SeedCityId.KAZAN,
      idempotencyKey: COMMAND_KEY,
      name: 'Склад 9',
      timeZone: 'Europe/Moscow',
    }), customerOptions);

    await vi.waitFor(() => {
      expect(received).toContain('warehouseChanged');
    }, WAIT_OPTIONS);
  });

  it('reports the memory storage and the leader role of the single tab', async () => {
    const opened = openEngine();
    const statuses: string[] = [];
    opened.connection.onStatus((status) => {
      statuses.push(status.state === 'ready' ? `${status.role}:${status.storage}` : status.state);
    });

    await createOrganizationClient(opened).listWarehouses({}, customerOptions);

    await vi.waitFor(() => {
      expect(statuses).toContain('leader:memory');
    }, WAIT_OPTIONS);
  });

  it('writes a checkpoint only when the test runs the timers', async () => {
    const storage = createSpyStorage();
    const opened = openEngine({ storage });
    await createOrganizationClient(opened).listWarehouses({}, customerOptions);
    const commitsBefore = storage.commits.length;

    opened.advanceRealTime(CHECKPOINT_INTERVAL_MS);

    await new Promise(resolve => setTimeout(resolve, 30));
    expect(storage.commits).toHaveLength(commitsBefore);

    opened.runTimers(CHECKPOINT_INTERVAL_MS);

    await vi.waitFor(() => {
      expect(storage.commits.length).toBeGreaterThan(commitsBefore);
    }, WAIT_OPTIONS);
  });

  it('does not tick between explicit timer runs', async () => {
    const opened = openEngine();
    await createOrganizationClient(opened).listWarehouses({}, customerOptions);

    expect(opened.pendingTimerCount()).toBeGreaterThan(0);

    opened.runTimers(TICK_INTERVAL_MS - 1);

    expect(opened.pendingTimerCount()).toBeGreaterThan(0);
  });

  it('releases the leader lock and the timers on close', async () => {
    const opened = openEngine();
    await createOrganizationClient(opened).listWarehouses({}, customerOptions);
    expect(opened.isLeaderLockHeld()).toBe(true);

    await opened.close();

    expect(opened.isLeaderLockHeld()).toBe(false);
    expect(opened.pendingTimerCount()).toBe(0);
  });

  it('rejects requests after close with the unavailable code', async () => {
    const opened = openEngine();
    const organization = createOrganizationClient(opened);
    await opened.close();

    await expect(organization.listWarehouses({}, customerOptions)).rejects.toMatchObject({ code: 14 });
  });

  it('closes twice without an error', async () => {
    const opened = openEngine();
    await createOrganizationClient(opened).listWarehouses({}, customerOptions);

    await opened.close();

    await expect(opened.close()).resolves.toBeUndefined();
  });
});
