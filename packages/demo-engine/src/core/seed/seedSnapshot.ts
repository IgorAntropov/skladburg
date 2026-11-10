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
  createSeedListingPrices,
  createSeedListings,
  createSeedPriceLists,
  createSeedProducts,
  createSeedSalesTerms,
} from './seedCatalog';
import {
  DEFAULT_ENGINE_SEED,
  type EngineSeedValue,
  SEED_TIME_SCALE,
  SEED_TRACE_RANDOM_SALT,
  SEED_VERSION,
  SEED_WORLD_START_MS,
} from './seedConfig';
import { createSeedFleetRecords } from './seedFleetRecords';
import {
  createSeedCities,
  createSeedMapNodes,
  createSeedRouteLegs,
} from './seedNetwork';
import { createSeedNotifications } from './seedNotifications';
import {
  createSeedOrganizations,
  createSeedOrganizationSettings,
} from './seedOrganizations';
import { createSeedPersonas } from './seedPersonas';
import {
  createSeedPlatformMemberships,
  createSeedPlatformOrganizations,
  createSeedPlatformOrganizationSettings,
  createSeedPlatformRoles,
  createSeedPlatformUsers,
} from './seedPlatform';
import { createSeedRequisites } from './seedRequisites';
import { createSeedSpheres } from './seedSpheres';
import { createSeedWarehouses } from './seedWarehouses';

export {
  DEFAULT_ENGINE_SEED,
  type EngineSeedValue,
  SEED_RANDOM_SEED,
  SEED_TIME_SCALE,
  SEED_TRACE_RANDOM_SALT,
  SEED_VERSION,
  SEED_WORLD_START_MS,
} from './seedConfig';

export type SeedRecordsValue
  = & Omit<SeedTableRecordsValue, UnseededTableName>
    & Partial<Pick<SeedTableRecordsValue, UnseededTableName>>;

type SeedTableRecordsValue = { [TName in TableName]: TableRecordsValue[TName][] };

type UnseededTableName
  = | 'dealReminderMarks'
    | 'deals'
    | 'documentNumbers'
    | 'documents'
    | 'idempotency'
    | 'importJobs'
    | 'payments'
    | 'productLinks'
    | 'supplyContracts'
    | 'supportAccessSessions'
    | 'supportAuditEntries'
    | 'supportBotQueue'
    | 'supportTicketMessages'
    | 'supportTickets'
    | 'transportOffers'
    | 'transportRequests'
    | 'trips';

export const createSeedRecords = (worldStartMs = SEED_WORLD_START_MS): SeedRecordsValue => ({
  ...createSeedFleetRecords(worldStartMs),
  cities: createSeedCities(),
  listingPrices: createSeedListingPrices(),
  listings: createSeedListings(),
  mapNodes: createSeedMapNodes(),
  memberships: [...createSeedMemberships(), ...createSeedPlatformMemberships()],
  notifications: createSeedNotifications(SEED_WORLD_START_MS),
  organizationRequisites: createSeedRequisites(),
  organizations: [...createSeedOrganizations(), ...createSeedPlatformOrganizations()],
  organizationSettings: [...createSeedOrganizationSettings(), ...createSeedPlatformOrganizationSettings()],
  personas: createSeedPersonas(),
  priceLists: createSeedPriceLists(),
  products: createSeedProducts(),
  roles: [...createSeedRoles(), ...createSeedPlatformRoles()],
  routeLegs: createSeedRouteLegs(),
  salesTerms: createSeedSalesTerms(),
  spheres: createSeedSpheres(),
  users: [...createSeedUsers(), ...createSeedPlatformUsers()],
  warehouses: createSeedWarehouses(),
});

const encodeRecords = <TName extends TableName>(name: TName, records: SeedTableRecordsValue[TName]): EngineCollectionValue => {
  const definition = TABLE_DEFINITIONS[name];

  return new Map(records.map(record => [definition.getId(record), definition.encode(record)]));
};

export const createSeedSnapshot = ({ randomSeed, worldStartMs }: EngineSeedValue = DEFAULT_ENGINE_SEED): EngineSnapshotValue => {
  const records = createSeedRecords(worldStartMs);
  const collections = createEmptyCollections();

  for (const name of ENGINE_COLLECTION_NAMES) {
    const seeded = records[name];
    if (seeded !== undefined) {
      collections[name] = encodeRecords(name, seeded);
    }
  }

  return {
    collections,
    meta: {
      channelSeq: {},
      randomState: createSeededRandom(randomSeed).getState(),
      schedulerDueAtMs: {},
      seedVersion: SEED_VERSION,
      timeScale: SEED_TIME_SCALE,
      traceRandomState: createSeededRandom(randomSeed ^ SEED_TRACE_RANDOM_SALT).getState(),
      worldTimeMs: worldStartMs,
    },
    schemaVersion: ENGINE_SCHEMA_VERSION,
  };
};
