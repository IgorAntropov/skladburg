import {
  describe,
  expect,
  it,
} from 'vitest';

import type { EngineSnapshotValue } from '../ports/index';
import type { SchedulerTaskValue } from '../scheduler/index';

import { createEngineWithTasks } from '../engine/createEngine';
import {
  createEngineCaller,
  createFakeRealTime,
  createSpyStorage,
  createWarehouseRequest,
} from '../engine/testing/engineHarness';
import { ENGINE_COLLECTION_NAMES } from '../ports/index';
import {
  createSeedSnapshot,
  SeedOrganizationId,
  SeedUserId,
} from '../seed/index';
import { createEmptySnapshot } from './emptySnapshot';
import { DemoPersonaKind } from './records';
import {
  ENGINE_SCHEMA_VERSION,
  isCurrentSnapshot,
} from './schemaVersion';

const SHAPE_FINGERPRINTS: Readonly<Record<number, readonly string[]>> = {
  1: [
    'collection.boardNodes:bytes',
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.memberships:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.spheres:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  2: [
    'collection.boardNodes:bytes',
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.memberships:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.spheres:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
};

const isPlainRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !(value instanceof Uint8Array) && !(value instanceof Map);

const joinUnique = (shapes: readonly string[], separator: string): string =>
  shapes.length === 0 ? 'empty' : [...new Set(shapes)].sort().join(separator);

const describeShape = (value: unknown): string => {
  if (value instanceof Uint8Array) {
    return 'bytes';
  }

  if (value === null) {
    return 'null';
  }

  if (isPlainRecord(value)) {
    const fields = Object.keys(value).sort().map(key => `${key}:${describeShape(value[key])}`);

    return `{${fields.join(',')}}`;
  }

  return typeof value;
};

const describeKeyedRecord = (value: unknown): string =>
  isPlainRecord(value) ? `record<${joinUnique(Object.values(value).map(describeShape), '|')}>` : describeShape(value);

const KEYED_META_FIELDS: ReadonlySet<string> = new Set(['channelSeq', 'schedulerDueAtMs']);

const describeSnapshotShape = (snapshot: EngineSnapshotValue): string[] => {
  const collections = [...ENGINE_COLLECTION_NAMES].sort().map((name) => {
    const records = [...snapshot.collections[name].values()];

    return `collection.${name}:${joinUnique(records.map(describeShape), '|')}`;
  });
  const meta = Object.keys(snapshot.meta).sort().map((key) => {
    const value: unknown = Reflect.get(snapshot.meta, key);

    return `meta.${key}:${KEYED_META_FIELDS.has(key) ? describeKeyedRecord(value) : describeShape(value)}`;
  });

  return [...collections, ...meta];
};

const populatedTask: SchedulerTaskValue = {
  id: 'fingerprint-task',
  intervalMs: 1_000,
  run: (transaction) => {
    transaction.put('personas', {
      id: 'fingerprint-persona',
      kind: DemoPersonaKind.BUYER,
      organizationId: SeedOrganizationId.BUYER_1,
      userId: SeedUserId.ADMIN_1,
    });
  },
};

const createPopulatedSnapshot = async (): Promise<EngineSnapshotValue> => {
  const realTime = createFakeRealTime(0);
  const storage = createSpyStorage();
  const engine = await createEngineWithTasks({ epoch: 'e', realTime, storage }, [populatedTask]);
  const caller = createEngineCaller(engine);

  await caller.organization.createWarehouse(
    createWarehouseRequest('3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153'),
    caller.options(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1),
  );
  realTime.advance(1_000);
  await engine.tick();

  const snapshot = await storage.load();

  if (snapshot === undefined) {
    throw new Error('Expected a stored snapshot');
  }

  return snapshot;
};

describe('snapshot shape', () => {
  it('has a fingerprint recorded for every schema version up to the current one', () => {
    const versions = Object.keys(SHAPE_FINGERPRINTS).map(Number).sort((current, next) => current - next);

    expect(versions).toEqual(Array.from({ length: ENGINE_SCHEMA_VERSION }, (_, index) => index + 1));
  });

  it('matches the fingerprint of the current schema version, so a changed shape needs a new version', async () => {
    expect(describeSnapshotShape(await createPopulatedSnapshot())).toEqual(SHAPE_FINGERPRINTS[ENGINE_SCHEMA_VERSION]);
  });

  it('differs from the fingerprints of all earlier schema versions', () => {
    const earlier = Object.entries(SHAPE_FINGERPRINTS)
      .filter(([version]) => Number(version) < ENGINE_SCHEMA_VERSION)
      .map(([, fingerprint]) => fingerprint.join('\n'));

    expect(earlier.length).toBeGreaterThan(0);
    expect(earlier).not.toContain(SHAPE_FINGERPRINTS[ENGINE_SCHEMA_VERSION]?.join('\n'));
    expect(new Set(earlier).size).toBe(earlier.length);
  });

  it('keeps the same collections and meta keys in the starting snapshot as in the populated one', async () => {
    const populated = await createPopulatedSnapshot();
    const seed = createSeedSnapshot();

    expect(Object.keys(seed.collections).sort()).toEqual(Object.keys(populated.collections).sort());
    expect(Object.keys(seed.collections).sort()).toEqual([...ENGINE_COLLECTION_NAMES].sort());
    expect(Object.keys(seed.meta).sort()).toEqual(Object.keys(populated.meta).sort());
  });
});

describe('schema version of a snapshot', () => {
  it('accepts the current version and rejects the first one', () => {
    const empty = createEmptySnapshot();

    expect(isCurrentSnapshot({ ...empty, schemaVersion: ENGINE_SCHEMA_VERSION }, empty.meta.seedVersion)).toBe(true);
    expect(isCurrentSnapshot({ ...empty, schemaVersion: 1 }, empty.meta.seedVersion)).toBe(false);
  });

  it('is version 2 since the meta carries the scheduler deadlines', () => {
    expect(ENGINE_SCHEMA_VERSION).toBe(2);
    expect(createSeedSnapshot().meta.schedulerDueAtMs).toEqual({});
  });
});
