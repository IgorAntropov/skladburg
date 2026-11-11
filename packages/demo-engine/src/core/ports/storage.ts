import type { ClockSnapshotValue } from './clock';
import type { RandomStateValue } from './random';

export const ENGINE_COLLECTION_NAMES = [
  'organizations',
  'organizationSettings',
  'organizationRequisites',
  'users',
  'memberships',
  'roles',
  'spheres',
  'cities',
  'mapNodes',
  'routeLegs',
  'warehouses',
  'warehouseTopologies',
  'stockBalances',
  'stockBatches',
  'stockMovements',
  'notifications',
  'supportAccessSessions',
  'supportAuditEntries',
  'supportTickets',
  'supportTicketMessages',
  'supportBotQueue',
  'idempotency',
  'importJobs',
  'personas',
  'products',
  'listings',
  'listingPrices',
  'priceLists',
  'salesTerms',
  'deals',
  'dealReminderMarks',
  'documentNumbers',
  'documents',
  'payments',
  'supplyContracts',
  'productLinks',
  'vehicles',
  'drivers',
  'carrierLanes',
  'transportOffers',
  'transportRequests',
  'trips',
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
  schedulerDueAtMs: Readonly<Record<string, number>>;
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
  carrierLanes: new Map(),
  cities: new Map(),
  dealReminderMarks: new Map(),
  deals: new Map(),
  documentNumbers: new Map(),
  documents: new Map(),
  drivers: new Map(),
  idempotency: new Map(),
  importJobs: new Map(),
  listingPrices: new Map(),
  listings: new Map(),
  mapNodes: new Map(),
  memberships: new Map(),
  notifications: new Map(),
  organizationRequisites: new Map(),
  organizations: new Map(),
  organizationSettings: new Map(),
  payments: new Map(),
  personas: new Map(),
  priceLists: new Map(),
  productLinks: new Map(),
  products: new Map(),
  roles: new Map(),
  routeLegs: new Map(),
  salesTerms: new Map(),
  spheres: new Map(),
  stockBalances: new Map(),
  stockBatches: new Map(),
  stockMovements: new Map(),
  supplyContracts: new Map(),
  supportAccessSessions: new Map(),
  supportAuditEntries: new Map(),
  supportBotQueue: new Map(),
  supportTicketMessages: new Map(),
  supportTickets: new Map(),
  transportOffers: new Map(),
  transportRequests: new Map(),
  trips: new Map(),
  users: new Map(),
  vehicles: new Map(),
  warehouses: new Map(),
  warehouseTopologies: new Map(),
});
