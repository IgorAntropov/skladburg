import type { ClockSnapshotValue } from './clock';
import type { RandomStateValue } from './random';

export const ENGINE_COLLECTION_NAMES = [
  'organizations',
  'organizationSettings',
  'users',
  'memberships',
  'roles',
  'spheres',
  'cities',
  'boardNodes',
  'warehouses',
  'idempotency',
  'personas',
] as const;

export interface EngineChangeSetValue {
  deletes: Readonly<Partial<Record<EngineCollectionName, readonly string[]>>>;
  meta: EngineMetaValue;
  puts: Readonly<Partial<Record<EngineCollectionName, EngineCollectionValue>>>;
}

export type EngineCollectionName = typeof ENGINE_COLLECTION_NAMES[number];

export type EngineCollectionValue = ReadonlyMap<string, StoredRecordValue>;

export interface EngineMetaValue extends ClockSnapshotValue {
  channelSeq: Readonly<Record<string, bigint>>;
  randomState: RandomStateValue;
  seedVersion: number;
  traceRandomState: RandomStateValue;
}

export interface EngineSnapshotValue {
  collections: Readonly<Record<EngineCollectionName, EngineCollectionValue>>;
  meta: EngineMetaValue;
  schemaVersion: number;
}

export interface IEngineStorage {
  commit: (changeSet: EngineChangeSetValue) => Promise<void>;
  load: () => Promise<EngineSnapshotValue | undefined>;
  replaceAll: (snapshot: EngineSnapshotValue) => Promise<void>;
}

export type StoredFieldValue = readonly StoredFieldValue[] | StoredObjectValue | StoredScalarValue | Uint8Array;

export interface StoredObjectValue {
  readonly [key: string]: StoredFieldValue;
}

export type StoredRecordValue = StoredObjectValue | Uint8Array;

export type StoredScalarValue = bigint | boolean | null | number | string;

export const createEmptyCollections = (): Record<EngineCollectionName, EngineCollectionValue> => ({
  boardNodes: new Map(),
  cities: new Map(),
  idempotency: new Map(),
  memberships: new Map(),
  organizations: new Map(),
  organizationSettings: new Map(),
  personas: new Map(),
  roles: new Map(),
  spheres: new Map(),
  users: new Map(),
  warehouses: new Map(),
});
