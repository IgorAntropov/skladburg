import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { wrap } from 'idb';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  EngineChangeSetValue,
  EngineCollectionName,
  EngineSnapshotValue,
  StoredRecordValue,
} from '../../core/ports/index';
import type { IIndexedDbEngineStorage } from './indexedDbStorage';

import { createEngine } from '../../core/engine/index';
import {
  createEngineCaller,
  createFakeRealTime,
  createWarehouseRequest,
  TEST_ENGINE_EPOCH,
} from '../../core/engine/testing/engineHarness';
import {
  createSeedSnapshot,
  SeedOrganizationId,
  SeedUserId,
} from '../../core/seed/index';
import {
  createIndexedDbStorage,
  INDEXED_DB_VERSION,
} from './indexedDbStorage';

const DATABASE_NAME = 'engine-test';
const WAREHOUSE_KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';

const openedStorages: IIndexedDbEngineStorage[] = [];

const openStorage = async (factory: IDBFactory = new IDBFactory()): Promise<IIndexedDbEngineStorage> => {
  const storage = await createIndexedDbStorage({ databaseName: DATABASE_NAME, factory });

  openedStorages.push(storage);

  return storage;
};

const createRichSnapshot = (): EngineSnapshotValue => {
  const seed = createSeedSnapshot();
  const bytes = new Uint8Array([0, 1, 2, 254, 255]);

  return {
    collections: {
      ...seed.collections,
      idempotency: new Map<string, StoredRecordValue>([
        [
          'key-1',
          {
            attempts: 3n,
            list: [1, 'two', null, true, { deep: [4n] }],
            payload: bytes,
          },
        ],
        ['key-2', bytes],
      ]),
    },
    meta: {
      ...seed.meta,
      channelSeq: { 'org:alpha': 7n, 'warehouse:beta': 9_007_199_254_740_993n },
      schedulerDueAtMs: { 'sensor-sweep': 1_234_567 },
      timeScale: 2,
      worldTimeMs: seed.meta.worldTimeMs + 5000,
    },
    schemaVersion: 7,
  };
};

const createUnclonableRecord = (): StoredRecordValue => new Proxy({}, {});

const withRecords = (
  snapshot: EngineSnapshotValue,
  name: EngineCollectionName,
  records: Iterable<readonly [string, StoredRecordValue]>,
): EngineSnapshotValue => ({
  ...snapshot,
  collections: { ...snapshot.collections, [name]: new Map(records) },
});

const openForeignConnection = (factory: IDBFactory, version: number): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = factory.open(DATABASE_NAME, version);

  request.addEventListener('success', () => {
    resolve(request.result);
  });
  request.addEventListener('error', () => {
    reject(request.error ?? new Error('The database did not open'));
  });
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const storage of openedStorages.splice(0)) {
    storage.close();
  }

  vi.restoreAllMocks();
});

describe('createIndexedDbStorage', () => {
  it('loads nothing from an empty database', async () => {
    const storage = await openStorage();

    expect(await storage.load()).toBeUndefined();
  });

  it('loads the snapshot written by replaceAll with every value type intact', async () => {
    const storage = await openStorage();
    const snapshot = createRichSnapshot();

    await storage.replaceAll(snapshot);

    expect(await storage.load()).toEqual(snapshot);
  });

  it('keeps the snapshot across a reopening of the database', async () => {
    const factory = new IDBFactory();
    const first = await openStorage(factory);
    const snapshot = createRichSnapshot();
    await first.replaceAll(snapshot);
    first.close();

    const second = await openStorage(factory);

    expect(await second.load()).toEqual(snapshot);
  });

  it('replaces the whole previous content on replaceAll', async () => {
    const storage = await openStorage();
    await storage.replaceAll(createRichSnapshot());
    const next = createSeedSnapshot();

    await storage.replaceAll(next);

    expect(await storage.load()).toEqual(next);
  });

  it('applies the puts, the deletes and the meta of a change set', async () => {
    const storage = await openStorage();
    const snapshot = createRichSnapshot();
    await storage.replaceAll(snapshot);
    const [firstOrganizationId] = [...snapshot.collections.organizations.keys()];
    const changeSet: EngineChangeSetValue = {
      deletes: { idempotency: ['key-2'], organizations: firstOrganizationId === undefined ? [] : [firstOrganizationId] },
      meta: { ...snapshot.meta, channelSeq: { 'org:alpha': 8n }, worldTimeMs: snapshot.meta.worldTimeMs + 1 },
      puts: {
        idempotency: new Map<string, StoredRecordValue>([['key-3', { attempts: 1n }]]),
        warehouses: new Map<string, StoredRecordValue>([['warehouse-new', { name: 'Склад 9', tags: ['a', 'b'] }]]),
      },
    };

    await storage.commit(changeSet);

    const loaded = await storage.load();
    expect(loaded?.meta).toEqual(changeSet.meta);
    expect(loaded?.schemaVersion).toBe(snapshot.schemaVersion);
    expect(loaded?.collections.idempotency).toEqual(
      new Map([['key-1', snapshot.collections.idempotency.get('key-1')], ['key-3', { attempts: 1n }]]),
    );
    expect(loaded?.collections.warehouses.get('warehouse-new')).toEqual({ name: 'Склад 9', tags: ['a', 'b'] });
    expect(loaded?.collections.organizations.size).toBe(snapshot.collections.organizations.size - 1);
    expect(loaded?.collections.users).toEqual(snapshot.collections.users);
  });

  it('overwrites an existing record on put', async () => {
    const storage = await openStorage();
    const snapshot = withRecords(createSeedSnapshot(), 'idempotency', [['key-1', { version: 1 }]]);
    await storage.replaceAll(snapshot);

    await storage.commit({
      deletes: {},
      meta: snapshot.meta,
      puts: { idempotency: new Map<string, StoredRecordValue>([['key-1', { version: 2 }]]) },
    });

    expect((await storage.load())?.collections.idempotency.get('key-1')).toEqual({ version: 2 });
  });

  it('changes only the meta on a checkpoint commit', async () => {
    const storage = await openStorage();
    const snapshot = createRichSnapshot();
    await storage.replaceAll(snapshot);
    const meta = { ...snapshot.meta, worldTimeMs: snapshot.meta.worldTimeMs + 60_000 };

    await storage.commit({ deletes: {}, meta, puts: {} });

    expect(await storage.load()).toEqual({ ...snapshot, meta });
  });

  it('keeps no record and no meta when a record in a later collection cannot be stored', async () => {
    const storage = await openStorage();
    const snapshot = createRichSnapshot();
    await storage.replaceAll(snapshot);

    await expect(storage.commit({
      deletes: { users: [...snapshot.collections.users.keys()] },
      meta: { ...snapshot.meta, worldTimeMs: snapshot.meta.worldTimeMs + 1 },
      puts: {
        organizations: new Map<string, StoredRecordValue>([['org-new', { name: 'new' }]]),
        warehouses: new Map<string, StoredRecordValue>([['warehouse-new', createUnclonableRecord()]]),
      },
    })).rejects.toThrow();

    expect(await storage.load()).toEqual(snapshot);
  });

  it('leaves an empty database empty when the first commit fails', async () => {
    const storage = await openStorage();
    const snapshot = createSeedSnapshot();

    await expect(storage.commit({
      deletes: {},
      meta: snapshot.meta,
      puts: { warehouses: new Map<string, StoredRecordValue>([['warehouse-new', createUnclonableRecord()]]) },
    })).rejects.toThrow();

    expect(await storage.load()).toBeUndefined();
  });

  it('stays usable after a failed commit', async () => {
    const storage = await openStorage();
    const snapshot = createRichSnapshot();
    await storage.replaceAll(snapshot);
    await expect(storage.commit({
      deletes: {},
      meta: snapshot.meta,
      puts: { warehouses: new Map<string, StoredRecordValue>([['warehouse-new', createUnclonableRecord()]]) },
    })).rejects.toThrow();
    const meta = { ...snapshot.meta, worldTimeMs: snapshot.meta.worldTimeMs + 1 };

    await storage.commit({ deletes: {}, meta, puts: {} });

    expect((await storage.load())?.meta).toEqual(meta);
  });

  it('keeps the previous snapshot when replaceAll fails midway', async () => {
    const storage = await openStorage();
    const snapshot = createRichSnapshot();
    await storage.replaceAll(snapshot);
    const broken = withRecords(createSeedSnapshot(), 'warehouses', [['warehouse-new', createUnclonableRecord()]]);

    await expect(storage.replaceAll(broken)).rejects.toThrow();

    expect(await storage.load()).toEqual(snapshot);
  });

  it('loads nothing after clear', async () => {
    const storage = await openStorage();
    await storage.replaceAll(createRichSnapshot());

    await storage.clear();

    expect(await storage.load()).toBeUndefined();
  });

  it('accepts a snapshot again after clear', async () => {
    const storage = await openStorage();
    await storage.replaceAll(createRichSnapshot());
    await storage.clear();
    const snapshot = createSeedSnapshot();

    await storage.replaceAll(snapshot);

    expect(await storage.load()).toEqual(snapshot);
  });

  it('rejects a snapshot whose header is incomplete', async () => {
    const factory = new IDBFactory();
    const storage = await openStorage(factory);
    const raw = await wrap(factory.open(DATABASE_NAME));
    expect(raw).toBeDefined();
    await raw?.put('meta', 2, 'schemaVersion');
    raw?.close();

    await expect(storage.load()).rejects.toThrow();
  });

  it('rejects a collection that holds a malformed record', async () => {
    const factory = new IDBFactory();
    const storage = await openStorage(factory);
    await storage.replaceAll(createSeedSnapshot());
    const raw = await wrap(factory.open(DATABASE_NAME));
    expect(raw).toBeDefined();
    await raw?.put('warehouses', 'not an object', 'broken');
    raw?.close();

    await expect(storage.load()).rejects.toThrow();
  });
});

describe('createIndexedDbStorage when another connection changes the version', () => {
  it('closes its connection and rejects later operations once another connection upgrades the database', async () => {
    const factory = new IDBFactory();
    const storage = await openStorage(factory);
    const snapshot = createSeedSnapshot();
    await storage.replaceAll(snapshot);

    const foreign = await openForeignConnection(factory, INDEXED_DB_VERSION + 1);

    expect(foreign.version).toBe(INDEXED_DB_VERSION + 1);
    expect(console.log).toHaveBeenCalledWith('> IndexedDbStorage -> versionchange:', expect.objectContaining({
      databaseName: DATABASE_NAME,
      newVersion: INDEXED_DB_VERSION + 1,
      oldVersion: INDEXED_DB_VERSION,
    }));
    await expect(storage.commit({ deletes: {}, meta: snapshot.meta, puts: {} })).rejects.toThrow();
    await expect(storage.replaceAll(snapshot)).rejects.toThrow();
    await expect(storage.load()).rejects.toThrow();
    foreign.close();
  });

  it('rejects the opening and logs when a connection without a versionchange handler holds the database', async () => {
    const factory = new IDBFactory();
    const foreign = await openForeignConnection(factory, INDEXED_DB_VERSION);

    await expect(createIndexedDbStorage({
      databaseName: DATABASE_NAME,
      factory,
      version: INDEXED_DB_VERSION + 1,
    })).rejects.toThrow();

    expect(console.log).toHaveBeenCalledWith('> IndexedDbStorage -> blocked:', expect.objectContaining({
      databaseName: DATABASE_NAME,
    }));
    foreign.close();
  });
});

describe('createIndexedDbStorage with the engine', () => {
  const buyerOptions = (caller: ReturnType<typeof createEngineCaller>): ReturnType<ReturnType<typeof createEngineCaller>['options']> =>
    caller.options(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);

  it('lets a new engine on the same database see a warehouse created by the previous one', async () => {
    const factory = new IDBFactory();
    const firstEngine = await createEngine({
      epoch: TEST_ENGINE_EPOCH,
      realTime: createFakeRealTime(),
      storage: await openStorage(factory),
    });
    const firstCaller = createEngineCaller(firstEngine);
    const created = await firstCaller.organization.createWarehouse(createWarehouseRequest(WAREHOUSE_KEY), buyerOptions(firstCaller));
    const createdId = created.warehouse?.id;

    const secondEngine = await createEngine({
      epoch: 'epoch-2',
      realTime: createFakeRealTime(),
      storage: await openStorage(factory),
    });
    const secondCaller = createEngineCaller(secondEngine);
    const listed = await secondCaller.organization.listWarehouses({}, buyerOptions(secondCaller));

    expect(createdId).toBeDefined();
    expect(listed.warehouses.map(warehouse => warehouse.id)).toContain(createdId);
    expect(listed.warehouses).toHaveLength(4);
  });

  it('keeps the world time of a checkpoint across a restart of the engine', async () => {
    const factory = new IDBFactory();
    const realTime = createFakeRealTime();
    const firstEngine = await createEngine({
      epoch: TEST_ENGINE_EPOCH,
      realTime,
      storage: await openStorage(factory),
    });
    realTime.advance(30_000);
    await firstEngine.checkpoint();
    const { worldTimeMs } = firstEngine.getClockSnapshot();

    const secondEngine = await createEngine({
      epoch: 'epoch-2',
      realTime: createFakeRealTime(),
      storage: await openStorage(factory),
    });

    expect(secondEngine.getClockSnapshot().worldTimeMs).toBeGreaterThanOrEqual(worldTimeMs);
  });
});
