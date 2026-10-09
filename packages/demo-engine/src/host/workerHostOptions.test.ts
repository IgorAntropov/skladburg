import 'fake-indexeddb/auto';
import {
  type Client,
  createClient,
  type Transport,
} from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  EngineConnectionStatusValue,
  IEngineConnection,
} from '../client/index';
import type { IEngineHost } from './hostTypes';
import type { IWorkerScope } from './workerHostOptions';

import { connectToEngine } from '../client/index';
import { callAs } from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import { ENGINE_BASE_URL } from '../protocol/index';
import { createEngineHost } from './createEngineHost';
import { createFakeLockManager } from './testing/fakeLockManager';
import { WAIT_OPTIONS } from './testing/hostScenario';
import { createWorkerHostOptions } from './workerHostOptions';

const TIME_ORIGIN_MS = 1_700_000_000_000;
const PERFORMANCE_NOW_MS = 1_234.5;

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FILLED_BYTE = 0x5a;

interface FakeScopeConfigValue {
  hasLocks?: boolean;
  hasRandomUuid?: boolean;
}

interface FakeScopeValue {
  channelCount: () => number;
  close: () => void;
  connection: IEngineConnection;
  generatedIds: string[];
  randomValuesCount: () => number;
  scope: IWorkerScope;
}

const createFakeScope = (config: FakeScopeConfigValue = {}): FakeScopeValue => {
  const { hasLocks = true, hasRandomUuid = true } = config;
  const { port1, port2 } = new MessageChannel();
  const generatedIds: string[] = [];
  let channels = 0;
  let randomValueCalls = 0;

  const scope: IWorkerScope = {
    addEventListener: (type, listener) => {
      port2.addEventListener(type, listener);
    },
    BroadcastChannel: class extends BroadcastChannel {
      public constructor(name: string) {
        super(`${name}:worker-options-test`);
        channels += 1;
      }
    },
    crypto: {
      getRandomValues: (bytes) => {
        randomValueCalls += 1;
        bytes.fill(FILLED_BYTE);

        return bytes;
      },
      ...hasRandomUuid
        ? {
            randomUUID: () => {
              const id = `scope-id-${String(generatedIds.length + 1)}`;
              generatedIds.push(id);

              return id;
            },
          }
        : {},
    },
    navigator: { locks: hasLocks ? createFakeLockManager() : undefined },
    performance: { now: () => PERFORMANCE_NOW_MS, timeOrigin: TIME_ORIGIN_MS },
    postMessage: (message, transfer) => {
      port2.postMessage(message, transfer);
    },
    removeEventListener: (type, listener) => {
      port2.removeEventListener(type, listener);
    },
    start: () => {
      port2.start();
    },
  };

  return {
    channelCount: () => channels,
    close: () => {
      port1.close();
      port2.close();
    },
    connection: connectToEngine(port1),
    generatedIds,
    randomValuesCount: () => randomValueCalls,
    scope,
  };
};

let fakeScope: FakeScopeValue;
let host: IEngineHost | undefined;

const replaceScope = (config: FakeScopeConfigValue): void => {
  fakeScope.connection.close();
  fakeScope.close();
  fakeScope = createFakeScope(config);
};

const createOrganizationClient = (): Client<typeof OrganizationService> => {
  const transport: Transport = createConnectTransport({
    baseUrl: ENGINE_BASE_URL,
    fetch: fakeScope.connection.fetch,
    useBinaryFormat: true,
  });

  return createClient(OrganizationService, transport);
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  fakeScope = createFakeScope();
});

afterEach(async () => {
  fakeScope.connection.close();
  await host?.stop();
  host = undefined;
  fakeScope.close();
  vi.restoreAllMocks();
});

describe('worker host options', () => {
  it('uses the scope as the port and its navigator locks as the lock manager', () => {
    const options = createWorkerHostOptions(fakeScope.scope);

    expect(options.port).toBe(fakeScope.scope);
    expect(options.lockManager).toBe(fakeScope.scope.navigator.locks);
  });

  it('builds the real time from the time origin of the scope and its performance clock', () => {
    const options = createWorkerHostOptions(fakeScope.scope);

    expect(options.realTime.now()).toBe(TIME_ORIGIN_MS + PERFORMANCE_NOW_MS);
  });

  it('generates identifiers through the crypto of the scope', () => {
    const options = createWorkerHostOptions(fakeScope.scope);

    expect(options.generateId()).toBe('scope-id-1');
    expect(fakeScope.generatedIds).toEqual(['scope-id-1']);
  });

  it('creates broadcast channels through the constructor of the scope', () => {
    const options = createWorkerHostOptions(fakeScope.scope);
    const channel = options.broadcastChannelFactory('engine-channel');

    expect(channel).toBeInstanceOf(BroadcastChannel);

    channel.close();
  });

  it('loads the core lazily and only on demand', async () => {
    const options = createWorkerHostOptions(fakeScope.scope);

    const core = await options.loadCore();

    expect(typeof core.createEngine).toBe('function');
  });

  it('opens the IndexedDB storage of the engine', async () => {
    const options = createWorkerHostOptions(fakeScope.scope);

    const opened = await options.openStorage();

    expect(opened.kind).toBe('indexed-db');

    if (opened.kind === 'indexed-db') {
      opened.storage.close();
    }
  });

  it('runs a working leader host over the scope', async () => {
    host = createEngineHost(createWorkerHostOptions(fakeScope.scope));
    const organization = createOrganizationClient();
    const statuses: string[] = [];
    fakeScope.connection.onStatus((status) => {
      statuses.push(status.state === 'ready'
        ? `${status.role}:${status.storage}:${status.coordination}:${status.storageHealth}`
        : status.state);
    });

    const response = await organization.listWarehouses({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));

    expect(response.warehouses).toHaveLength(3);
    await vi.waitFor(() => {
      expect(statuses).toContain('leader:indexed-db:shared:ok');
    }, WAIT_OPTIONS);
  });
});

describe('worker host options without locks and randomUUID', () => {
  it('has no lock manager when the scope has no locks', () => {
    replaceScope({ hasLocks: false });

    expect(createWorkerHostOptions(fakeScope.scope).lockManager).toBeUndefined();
  });

  it('builds UUID v4 identifiers from the random values of the scope when randomUUID is missing', () => {
    replaceScope({ hasRandomUuid: false });
    const options = createWorkerHostOptions(fakeScope.scope);

    const id = options.generateId();

    expect(id).toBe('5a5a5a5a-5a5a-4a5a-9a5a-5a5a5a5a5a5a');
    expect(id).toMatch(UUID_V4_PATTERN);
    expect(fakeScope.randomValuesCount()).toBe(1);
    expect(fakeScope.generatedIds).toEqual([]);
  });

  it('starts a single-tab leader in memory, serves a request and never opens a broadcast channel', async () => {
    replaceScope({ hasLocks: false, hasRandomUuid: false });
    host = createEngineHost(createWorkerHostOptions(fakeScope.scope));
    const organization = createOrganizationClient();
    const statuses: EngineConnectionStatusValue[] = [];
    fakeScope.connection.onStatus((status) => {
      statuses.push(status);
    });

    const response = await organization.listWarehouses({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));

    expect(response.warehouses).toHaveLength(3);
    await vi.waitFor(() => {
      expect(statuses.at(-1)).toMatchObject({
        coordination: 'single-tab',
        role: 'leader',
        state: 'ready',
        storage: 'memory',
        storageHealth: 'ok',
      });
    }, WAIT_OPTIONS);
    expect(statuses.map(status => status.state === 'ready' ? status.epoch : '').at(-1)).toMatch(UUID_V4_PATTERN);
    expect(fakeScope.channelCount()).toBe(0);
  });
});
