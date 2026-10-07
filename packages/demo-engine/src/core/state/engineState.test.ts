import { create } from '@bufbuild/protobuf';
import { WarehouseSchema } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createMemoryStorage } from '../ports/index';
import { createEmptySnapshot } from './emptySnapshot';
import {
  createEngineState,
  type IEngineState,
} from './engineState';
import {
  ENGINE_SCHEMA_VERSION,
  isCurrentSnapshot,
} from './schemaVersion';
import {
  createLiveMeta,
  createTestMembership,
  createTestWarehouse,
  createVolatileMeta,
  FIRST_TENANT_ID,
  SECOND_TENANT_ID,
  TEST_WORLD_TIME_MS,
} from './testRecords';

const createStateWithWarehouses = (): IEngineState => {
  const state = createEngineState(createEmptySnapshot());
  const outcome = state.transact(TEST_WORLD_TIME_MS, (transaction) => {
    transaction.put('warehouses', createTestWarehouse('wh-b', FIRST_TENANT_ID, 'Склад B'));
    transaction.put('warehouses', createTestWarehouse('wh-a', FIRST_TENANT_ID, 'Склад A'));
    transaction.put('warehouses', createTestWarehouse('wh-c', SECOND_TENANT_ID, 'Склад C'));
  }, createLiveMeta);
  outcome.apply();

  return state;
};

describe('createEngineState reads', () => {
  it('starts empty from an empty snapshot', () => {
    const state = createEngineState(createEmptySnapshot());

    expect(state.read.list('warehouses')).toEqual([]);
    expect(state.read.get('warehouses', 'wh-1')).toBeUndefined();
    expect(state.getChannelSeq('org:x')).toBe(0n);
  });

  it('returns records sorted by id regardless of the insertion order', () => {
    expect(createStateWithWarehouses().read.list('warehouses').map(warehouse => warehouse.id)).toEqual(['wh-a', 'wh-b', 'wh-c']);
  });

  it('finds records by an index', () => {
    const state = createStateWithWarehouses();

    expect(state.read.listBy('warehouses', 'tenantId', FIRST_TENANT_ID).map(warehouse => warehouse.id)).toEqual(['wh-a', 'wh-b']);
    expect(state.read.listBy('warehouses', 'tenantId', SECOND_TENANT_ID).map(warehouse => warehouse.id)).toEqual(['wh-c']);
    expect(state.read.listBy('warehouses', 'tenantId', 'nobody')).toEqual([]);
  });

  it('finds memberships by user and by organization', () => {
    const state = createEngineState(createEmptySnapshot());
    state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('memberships', createTestMembership('m-1', 'user-1', FIRST_TENANT_ID));
      transaction.put('memberships', createTestMembership('m-2', 'user-1', SECOND_TENANT_ID));
      transaction.put('memberships', createTestMembership('m-3', 'user-2', FIRST_TENANT_ID));
    }, createLiveMeta).apply();

    expect(state.read.listBy('memberships', 'userId', 'user-1').map(membership => membership.id)).toEqual(['m-1', 'm-2']);
    expect(state.read.listBy('memberships', 'organizationId', FIRST_TENANT_ID).map(membership => membership.id)).toEqual(['m-1', 'm-3']);
  });

  it('hands out copies: mutating a result does not touch the state', () => {
    const state = createStateWithWarehouses();
    const warehouse = state.read.get('warehouses', 'wh-a');

    if (warehouse === undefined) {
      throw new Error('Expected warehouse wh-a');
    }

    warehouse.name = 'Испорчено';

    expect(state.read.get('warehouses', 'wh-a')?.name).toBe('Склад A');
    expect(state.read.list('warehouses')[0]).not.toBe(state.read.list('warehouses')[0]);
  });
});

describe('createEngineState.transact', () => {
  it('collects all writes of a command into one change set', () => {
    const state = createEngineState(createEmptySnapshot());
    const outcome = state.transact(5_000, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-1', FIRST_TENANT_ID));
      transaction.put('memberships', createTestMembership('m-1', 'user-1', FIRST_TENANT_ID));
    }, () => createVolatileMeta(5_000));

    expect(Object.keys(outcome.changeSet?.puts ?? {}).sort()).toEqual(['memberships', 'warehouses']);
    expect(outcome.changeSet?.puts.warehouses?.size).toBe(1);
    expect(outcome.changeSet?.deletes).toEqual({});
    expect(outcome.changeSet?.meta.worldTimeMs).toBe(5_000);
  });

  it('keeps the state untouched until the outcome is applied', () => {
    const state = createEngineState(createEmptySnapshot());
    const outcome = state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-1', FIRST_TENANT_ID));
    }, createLiveMeta);

    expect(state.read.list('warehouses')).toEqual([]);

    outcome.apply();

    expect(state.read.list('warehouses').map(warehouse => warehouse.id)).toEqual(['wh-1']);
  });

  it('returns the result of the work', () => {
    const state = createEngineState(createEmptySnapshot());

    expect(state.transact(TEST_WORLD_TIME_MS, () => 42, createLiveMeta).result).toBe(42);
  });

  it('rolls back on an exception: nothing is applied and the error is rethrown', () => {
    const state = createStateWithWarehouses();
    const before = state.toSnapshot(createVolatileMeta());

    expect(() => state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-new', FIRST_TENANT_ID));
      transaction.delete('warehouses', 'wh-a');
      transaction.nextChannelSeq('org:x');
      throw new Error('command failed');
    }, createLiveMeta)).toThrow('command failed');

    expect(state.toSnapshot(createVolatileMeta())).toEqual(before);
    expect(state.getChannelSeq('org:x')).toBe(0n);
  });

  it('works normally after a rolled back transaction', () => {
    const state = createEngineState(createEmptySnapshot());

    expect(() => state.transact(TEST_WORLD_TIME_MS, () => {
      throw new Error('failed');
    }, createLiveMeta)).toThrow('failed');

    state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-1', FIRST_TENANT_ID));
    }, createLiveMeta).apply();

    expect(state.read.list('warehouses')).toHaveLength(1);
  });

  it('creates no change set for a read-only transaction', () => {
    const state = createStateWithWarehouses();
    const outcome = state.transact(TEST_WORLD_TIME_MS, transaction => transaction.list('warehouses').length, createLiveMeta);

    expect(outcome.result).toBe(3);
    expect(outcome.changeSet).toBeUndefined();
    expect(() => {
      outcome.apply();
    }).not.toThrow();
  });

  it('creates no change set when a nonexistent record is deleted', () => {
    const state = createEngineState(createEmptySnapshot());
    const outcome = state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.delete('warehouses', 'ghost');
    }, createLiveMeta);

    expect(outcome.changeSet).toBeUndefined();
  });

  it('lets the transaction see its own writes through get, list and listBy', () => {
    const state = createStateWithWarehouses();

    state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-d', FIRST_TENANT_ID, 'Склад D'));
      transaction.put('warehouses', createTestWarehouse('wh-b', SECOND_TENANT_ID, 'Склад B перенесён'));
      transaction.delete('warehouses', 'wh-a');

      expect(transaction.get('warehouses', 'wh-d')?.name).toBe('Склад D');
      expect(transaction.get('warehouses', 'wh-a')).toBeUndefined();
      expect(transaction.list('warehouses').map(warehouse => warehouse.id)).toEqual(['wh-b', 'wh-c', 'wh-d']);
      expect(transaction.listBy('warehouses', 'tenantId', FIRST_TENANT_ID).map(warehouse => warehouse.id)).toEqual(['wh-d']);
      expect(transaction.listBy('warehouses', 'tenantId', SECOND_TENANT_ID).map(warehouse => warehouse.id)).toEqual(['wh-b', 'wh-c']);
    }, createLiveMeta);
  });

  it('puts a deleted-then-recreated record and drops a created-then-deleted one', () => {
    const state = createStateWithWarehouses();
    const outcome = state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.delete('warehouses', 'wh-a');
      transaction.put('warehouses', createTestWarehouse('wh-a', FIRST_TENANT_ID, 'Склад A2'));
      transaction.put('warehouses', createTestWarehouse('wh-temp', FIRST_TENANT_ID));
      transaction.delete('warehouses', 'wh-temp');
    }, createLiveMeta);

    expect([...(outcome.changeSet?.puts.warehouses?.keys() ?? [])]).toEqual(['wh-a']);
    expect(outcome.changeSet?.deletes).toEqual({});
  });

  it('reports a delete of an existing record and applies it with the index', () => {
    const state = createStateWithWarehouses();
    const outcome = state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.delete('warehouses', 'wh-a');
    }, createLiveMeta);

    expect(outcome.changeSet?.deletes).toEqual({ warehouses: ['wh-a'] });

    outcome.apply();

    expect(state.read.get('warehouses', 'wh-a')).toBeUndefined();
    expect(state.read.listBy('warehouses', 'tenantId', FIRST_TENANT_ID).map(warehouse => warehouse.id)).toEqual(['wh-b']);
  });

  it('moves a record between index buckets when the key changes', () => {
    const state = createStateWithWarehouses();
    state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-a', SECOND_TENANT_ID));
    }, createLiveMeta).apply();

    expect(state.read.listBy('warehouses', 'tenantId', FIRST_TENANT_ID).map(warehouse => warehouse.id)).toEqual(['wh-b']);
    expect(state.read.listBy('warehouses', 'tenantId', SECOND_TENANT_ID).map(warehouse => warehouse.id)).toEqual(['wh-a', 'wh-c']);
  });

  it('rejects a record without an id', () => {
    const state = createEngineState(createEmptySnapshot());

    expect(() => state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', create(WarehouseSchema, { name: 'Без идентификатора' }));
    }, createLiveMeta)).toThrow('without an id');
  });

  it('reads the volatile meta after the work, so random draws made by the work are stored', () => {
    const state = createEngineState(createEmptySnapshot());
    let randomA = 1;

    const outcome = state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-1', FIRST_TENANT_ID));
      randomA = 99;
    }, () => ({ ...createLiveMeta(), randomState: { a: randomA, b: 2, c: 3, d: 4 } }));

    expect(outcome.changeSet?.meta.randomState.a).toBe(99);
  });

  it('stores the trace random state of the live meta with the commit', () => {
    const state = createEngineState(createEmptySnapshot());

    const outcome = state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-1', FIRST_TENANT_ID));
    }, () => ({ ...createLiveMeta(), traceRandomState: { a: 42, b: 6, c: 7, d: 8 } }));
    outcome.apply();

    expect(outcome.changeSet?.meta.traceRandomState.a).toBe(42);
    expect(state.getMeta().traceRandomState).toEqual({ a: 42, b: 6, c: 7, d: 8 });
  });

  it('refuses to apply an outcome that was prepared before the state changed', () => {
    const state = createEngineState(createEmptySnapshot());
    const first = state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-1', FIRST_TENANT_ID));
    }, createLiveMeta);
    const second = state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-2', FIRST_TENANT_ID));
    }, createLiveMeta);

    first.apply();

    expect(() => {
      second.apply();
    }).toThrow('changed after the transaction was prepared');
  });
});

describe('createEngineState channel sequences', () => {
  it('numbers events of a channel inside a transaction from the committed value', () => {
    const state = createEngineState(createEmptySnapshot());
    const outcome = state.transact(TEST_WORLD_TIME_MS, transaction => [
      transaction.nextChannelSeq('org:a'),
      transaction.nextChannelSeq('org:a'),
      transaction.nextChannelSeq('org:b'),
    ], createLiveMeta);

    expect(outcome.result).toEqual([1n, 2n, 1n]);
    expect(outcome.changeSet?.meta.channelSeq).toEqual({ 'org:a': 2n, 'org:b': 1n });
    expect(state.getChannelSeq('org:a')).toBe(0n);

    outcome.apply();

    expect(state.getChannelSeq('org:a')).toBe(2n);
    expect(state.getChannelSeq('org:b')).toBe(1n);
  });

  it('continues after the committed value in the next transaction', () => {
    const state = createEngineState(createEmptySnapshot());
    state.transact(TEST_WORLD_TIME_MS, transaction => transaction.nextChannelSeq('org:a'), createLiveMeta).apply();

    const outcome = state.transact(TEST_WORLD_TIME_MS, transaction => transaction.nextChannelSeq('org:a'), createLiveMeta);

    expect(outcome.result).toBe(2n);
    expect(outcome.changeSet?.meta.channelSeq).toEqual({ 'org:a': 2n });
  });

  it('counts a sequence step as a change even without record writes', () => {
    const state = createEngineState(createEmptySnapshot());

    expect(state.transact(TEST_WORLD_TIME_MS, transaction => transaction.nextChannelSeq('org:a'), createLiveMeta).changeSet).toBeDefined();
  });
});

describe('createEngineState snapshots', () => {
  it('exports the committed state with the live volatile meta', () => {
    const state = createStateWithWarehouses();
    const snapshot = state.toSnapshot(createVolatileMeta(77_000));

    expect(snapshot.meta.worldTimeMs).toBe(77_000);
    expect(snapshot.meta.randomState).toEqual(createLiveMeta().randomState);
    expect(snapshot.meta.traceRandomState).toEqual(createLiveMeta().traceRandomState);
    expect(snapshot.schemaVersion).toBe(ENGINE_SCHEMA_VERSION);
    expect([...snapshot.collections.warehouses.keys()]).toEqual(['wh-a', 'wh-b', 'wh-c']);
  });

  it('reproduces the same snapshot after loading it into a new state', () => {
    const snapshot = createStateWithWarehouses().toSnapshot(createVolatileMeta());

    expect(createEngineState(snapshot).toSnapshot(createVolatileMeta())).toEqual(snapshot);
  });

  it('replaces everything on replaceAll, including meta and indexes', () => {
    const state = createStateWithWarehouses();
    state.transact(TEST_WORLD_TIME_MS, transaction => transaction.nextChannelSeq('org:a'), createLiveMeta).apply();

    state.replaceAll(createEmptySnapshot());

    expect(state.read.list('warehouses')).toEqual([]);
    expect(state.read.listBy('warehouses', 'tenantId', FIRST_TENANT_ID)).toEqual([]);
    expect(state.getChannelSeq('org:a')).toBe(0n);
  });

  it('invalidates an outcome prepared before replaceAll', () => {
    const state = createEngineState(createEmptySnapshot());
    const outcome = state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-1', FIRST_TENANT_ID));
    }, createLiveMeta);

    state.replaceAll(createEmptySnapshot());

    expect(() => {
      outcome.apply();
    }).toThrow();
  });

  it('refuses a snapshot whose record key differs from the id inside', () => {
    const snapshot = createStateWithWarehouses().toSnapshot(createVolatileMeta());
    const warehouses = new Map([...snapshot.collections.warehouses].map(([, record]) => ['wrong-key', record] as const));

    expect(() => createEngineState({ ...snapshot, collections: { ...snapshot.collections, warehouses } })).toThrow('does not match');
  });

  it('keeps the loaded meta isolated from the snapshot object', () => {
    const snapshot = createEmptySnapshot();
    const state = createEngineState(snapshot);

    snapshot.meta.randomState.a = 12345;

    expect(state.getMeta().randomState.a).not.toBe(12345);
  });

  it('recognizes the current schema version and the expected seed version', () => {
    const empty = createEmptySnapshot();
    const expectedSeedVersion = empty.meta.seedVersion;

    expect(isCurrentSnapshot(empty, expectedSeedVersion)).toBe(true);
    expect(isCurrentSnapshot({ ...empty, schemaVersion: ENGINE_SCHEMA_VERSION + 1 }, expectedSeedVersion)).toBe(false);
    expect(isCurrentSnapshot({ ...empty, meta: { ...empty.meta, seedVersion: expectedSeedVersion + 1 } }, expectedSeedVersion)).toBe(false);
    expect(isCurrentSnapshot(undefined, expectedSeedVersion)).toBe(false);
  });
});

describe('createEngineState with storage', () => {
  it('commits one change set to the storage and reloads to the same state', async () => {
    const storage = createMemoryStorage(createEmptySnapshot());
    const state = createEngineState((await storage.load()) ?? createEmptySnapshot());
    const outcome = state.transact(9_000, (transaction) => {
      transaction.put('warehouses', createTestWarehouse('wh-1', FIRST_TENANT_ID));
      transaction.put('warehouses', createTestWarehouse('wh-2', FIRST_TENANT_ID));
      transaction.nextChannelSeq('org:a');
    }, () => createVolatileMeta(9_000));

    if (outcome.changeSet === undefined) {
      throw new Error('Expected a change set');
    }

    await storage.commit(outcome.changeSet);
    outcome.apply();

    const reloaded = createEngineState((await storage.load()) ?? createEmptySnapshot());

    expect(reloaded.toSnapshot(createVolatileMeta(9_000))).toEqual(state.toSnapshot(createVolatileMeta(9_000)));
    expect(reloaded.getChannelSeq('org:a')).toBe(1n);
  });
});
