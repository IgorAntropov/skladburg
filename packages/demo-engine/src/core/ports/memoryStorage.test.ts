import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  EngineChangeSetValue,
  EngineMetaValue,
  EngineSnapshotValue,
  StoredRecordValue,
} from './storage';

import { createMemoryStorage } from './memoryStorage';
import { createEmptyCollections } from './storage';

const createMeta = (overrides: Partial<EngineMetaValue> = {}): EngineMetaValue => ({
  channelSeq: {},
  randomState: { a: 1, b: 2, c: 3, d: 4 },
  schedulerDueAtMs: {},
  seedVersion: 1,
  timeScale: 1,
  traceRandomState: { a: 5, b: 6, c: 7, d: 8 },
  worldTimeMs: 1_000,
  ...overrides,
});

const createSnapshot = (): EngineSnapshotValue => ({
  collections: {
    ...createEmptyCollections(),
    organizations: new Map<string, StoredRecordValue>([['org-1', new Uint8Array([1, 2, 3])]]),
    warehouses: new Map<string, StoredRecordValue>([
      ['wh-1', { name: 'one' }],
      ['wh-2', { name: 'two' }],
    ]),
  },
  meta: createMeta(),
  schemaVersion: 3,
});

describe('createMemoryStorage', () => {
  it('has no snapshot when created without initial data', async () => {
    await expect(createMemoryStorage().load()).resolves.toBeUndefined();
  });

  it('loads the initial snapshot', async () => {
    const loaded = await createMemoryStorage(createSnapshot()).load();

    expect(loaded).toEqual(createSnapshot());
  });

  it('keeps what replaceAll stored and drops what was there before', async () => {
    const storage = createMemoryStorage(createSnapshot());
    const replacement: EngineSnapshotValue = {
      collections: { ...createEmptyCollections(), users: new Map<string, StoredRecordValue>([['u-1', { name: 'user' }]]) },
      meta: createMeta({ worldTimeMs: 9 }),
      schemaVersion: 4,
    };

    await storage.replaceAll(replacement);

    expect(await storage.load()).toEqual(replacement);
  });

  it('accepts replaceAll on an empty storage', async () => {
    const storage = createMemoryStorage();

    await storage.replaceAll(createSnapshot());

    expect(await storage.load()).toEqual(createSnapshot());
  });

  describe('commit', () => {
    it('applies puts, deletes and the meta', async () => {
      const storage = createMemoryStorage(createSnapshot());
      const changeSet: EngineChangeSetValue = {
        deletes: { warehouses: ['wh-1'] },
        meta: createMeta({ worldTimeMs: 2_000 }),
        puts: {
          users: new Map<string, StoredRecordValue>([['u-1', { name: 'user' }]]),
          warehouses: new Map<string, StoredRecordValue>([['wh-3', { name: 'three' }]]),
        },
      };

      await storage.commit(changeSet);
      const loaded = await storage.load();

      expect([...(loaded?.collections.warehouses.keys() ?? [])].sort()).toEqual(['wh-2', 'wh-3']);
      expect(loaded?.collections.users.get('u-1')).toEqual({ name: 'user' });
      expect(loaded?.collections.organizations.get('org-1')).toEqual(new Uint8Array([1, 2, 3]));
      expect(loaded?.meta.worldTimeMs).toBe(2_000);
      expect(loaded?.schemaVersion).toBe(3);
    });

    it('overwrites an existing record on put', async () => {
      const storage = createMemoryStorage(createSnapshot());

      await storage.commit({
        deletes: {},
        meta: createMeta(),
        puts: { warehouses: new Map<string, StoredRecordValue>([['wh-1', { name: 'renamed' }]]) },
      });

      expect((await storage.load())?.collections.warehouses.get('wh-1')).toEqual({ name: 'renamed' });
    });

    it('lets a put win over a delete of the same id in one change set', async () => {
      const storage = createMemoryStorage(createSnapshot());

      await storage.commit({
        deletes: { warehouses: ['wh-1'] },
        meta: createMeta(),
        puts: { warehouses: new Map<string, StoredRecordValue>([['wh-1', { name: 'recreated' }]]) },
      });

      expect((await storage.load())?.collections.warehouses.get('wh-1')).toEqual({ name: 'recreated' });
    });

    it('ignores a delete of a missing id', async () => {
      const storage = createMemoryStorage(createSnapshot());

      await storage.commit({ deletes: { warehouses: ['missing'] }, meta: createMeta(), puts: {} });

      expect((await storage.load())?.collections.warehouses.size).toBe(2);
    });

    it('rejects when the storage holds no snapshot', async () => {
      await expect(createMemoryStorage().commit({ deletes: {}, meta: createMeta(), puts: {} })).rejects.toThrow(Error);
    });

    it('leaves the state untouched when the change set cannot be cloned', async () => {
      const storage = createMemoryStorage(createSnapshot());
      const unclonable = { run: (): number => 1 } as unknown as StoredRecordValue;

      await expect(storage.commit({
        deletes: { warehouses: ['wh-1'] },
        meta: createMeta({ worldTimeMs: 5 }),
        puts: { users: new Map<string, StoredRecordValue>([['u-1', unclonable]]) },
      })).rejects.toThrow(Error);

      expect(await storage.load()).toEqual(createSnapshot());
    });
  });

  describe('isolation from caller mutations', () => {
    it('does not follow later mutations of the initial snapshot', async () => {
      const initial = createSnapshot();
      const storage = createMemoryStorage(initial);

      (initial.collections.warehouses as Map<string, StoredRecordValue>).delete('wh-1');
      (initial.meta.randomState as { a: number }).a = 999;

      expect(await storage.load()).toEqual(createSnapshot());
    });

    it('does not follow later mutations of a snapshot given to replaceAll', async () => {
      const storage = createMemoryStorage();
      const snapshot = createSnapshot();
      await storage.replaceAll(snapshot);

      (snapshot.collections.organizations as Map<string, StoredRecordValue>).clear();

      expect(await storage.load()).toEqual(createSnapshot());
    });

    it('does not follow later mutations of a committed change set', async () => {
      const storage = createMemoryStorage(createSnapshot());
      const record = { name: 'three' };
      const puts = new Map<string, StoredRecordValue>([['wh-3', record]]);
      const meta = createMeta();

      await storage.commit({ deletes: {}, meta, puts: { warehouses: puts } });
      record.name = 'mutated';
      puts.clear();
      meta.worldTimeMs = 42;

      const loaded = await storage.load();

      expect(loaded?.collections.warehouses.get('wh-3')).toEqual({ name: 'three' });
      expect(loaded?.meta.worldTimeMs).toBe(1_000);
    });

    it('does not let a loaded snapshot change the stored state', async () => {
      const storage = createMemoryStorage(createSnapshot());
      const loaded = await storage.load();

      (loaded?.collections.warehouses as Map<string, StoredRecordValue> | undefined)?.clear();
      const bytes = loaded?.collections.organizations.get('org-1');

      if (bytes instanceof Uint8Array) {
        bytes[0] = 255;
      }

      expect(await storage.load()).toEqual(createSnapshot());
    });
  });

  describe('bigint in the meta', () => {
    it('keeps channel sequence numbers as bigint through commit and load', async () => {
      const storage = createMemoryStorage(createSnapshot());
      const channelSeq = { 'org:11111111-1111-4111-8111-111111111111': 18_446_744_073_709_551_615n, 'user:x': 2n };

      await storage.commit({ deletes: {}, meta: createMeta({ channelSeq }), puts: {} });
      const loaded = await storage.load();

      expect(loaded?.meta.channelSeq).toEqual(channelSeq);
      expect(typeof loaded?.meta.channelSeq['user:x']).toBe('bigint');
    });

    it('survives structured cloning as the browser database does', () => {
      const meta = createMeta({ channelSeq: { 'org:a': 7n } });

      expect(structuredClone(meta).channelSeq['org:a']).toBe(7n);
    });
  });
});
