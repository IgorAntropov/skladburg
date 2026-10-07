import type {
  EngineCollectionValue,
  EngineSnapshotValue,
} from '../ports/index';
import type {
  TableName,
  TableRecordsValue,
} from '../state/index';

import {
  createEmptyCollections,
  createSeededRandom,
  ENGINE_COLLECTION_NAMES,
} from '../ports/index';
import {
  ENGINE_SCHEMA_VERSION,
  TABLE_DEFINITIONS,
} from '../state/index';
import {
  createSeedMemberships,
  createSeedRoles,
  createSeedUsers,
} from './seedAccess';
import {
  createSeedBoardNodes,
  createSeedCities,
} from './seedNetwork';
import {
  createSeedOrganizations,
  createSeedOrganizationSettings,
} from './seedOrganizations';
import { createSeedPersonas } from './seedPersonas';
import { createSeedSpheres } from './seedSpheres';
import { createSeedWarehouses } from './seedWarehouses';

export interface EngineSeedValue {
  randomSeed: number;
  worldStartMs: number;
}

export type SeedRecordsValue = {
  [TName in TableName]: TableRecordsValue[TName][];
};

export const SEED_VERSION = 1;
export const SEED_TIME_SCALE = 1;
export const SEED_WORLD_START_MS = Date.UTC(2026, 9, 12, 6, 0, 0);
export const SEED_RANDOM_SEED = 20261012;
export const SEED_TRACE_RANDOM_SALT = 0x74726163;

export const DEFAULT_ENGINE_SEED: EngineSeedValue = {
  randomSeed: SEED_RANDOM_SEED,
  worldStartMs: SEED_WORLD_START_MS,
};

export const createSeedRecords = (): SeedRecordsValue => ({
  boardNodes: createSeedBoardNodes(),
  cities: createSeedCities(),
  idempotency: [],
  memberships: createSeedMemberships(),
  organizations: createSeedOrganizations(),
  organizationSettings: createSeedOrganizationSettings(),
  personas: createSeedPersonas(),
  roles: createSeedRoles(),
  spheres: createSeedSpheres(),
  users: createSeedUsers(),
  warehouses: createSeedWarehouses(),
});

const encodeRecords = <TName extends TableName>(name: TName, records: SeedRecordsValue[TName]): EngineCollectionValue => {
  const definition = TABLE_DEFINITIONS[name];

  return new Map(records.map(record => [definition.getId(record), definition.encode(record)]));
};

export const createSeedSnapshot = (seed: EngineSeedValue = DEFAULT_ENGINE_SEED): EngineSnapshotValue => {
  const records = createSeedRecords();
  const collections = createEmptyCollections();

  for (const name of ENGINE_COLLECTION_NAMES) {
    collections[name] = encodeRecords(name, records[name]);
  }

  return {
    collections,
    meta: {
      channelSeq: {},
      randomState: createSeededRandom(seed.randomSeed).getState(),
      seedVersion: SEED_VERSION,
      timeScale: SEED_TIME_SCALE,
      traceRandomState: createSeededRandom(seed.randomSeed ^ SEED_TRACE_RANDOM_SALT).getState(),
      worldTimeMs: seed.worldStartMs,
    },
    schemaVersion: ENGINE_SCHEMA_VERSION,
  };
};
