import type { EngineSnapshotValue } from '../ports/index';

import { addWarehouseTopologies } from './migrateWarehouseTopologies';

const PRE_FLEET_SCHEMA_VERSION = 15;
const PRE_TRIPS_SCHEMA_VERSION = 17;
const PRE_TOPOLOGY_SCHEMA_VERSION = 18;

export const migrateStoredSnapshot = async (stored: EngineSnapshotValue): Promise<EngineSnapshotValue> => {
  if (stored.schemaVersion === PRE_TOPOLOGY_SCHEMA_VERSION) {
    return addWarehouseTopologies(stored);
  }

  const collections = stored.schemaVersion === PRE_TRIPS_SCHEMA_VERSION
    ? stored.collections
    : { ...stored.collections, transportOffers: new Map(), transportRequests: new Map() };
  let migrated: EngineSnapshotValue = {
    ...stored,
    collections: { ...collections, trips: new Map(), warehouseTopologies: new Map() },
  };

  if (stored.schemaVersion === PRE_FLEET_SCHEMA_VERSION) {
    migrated = (await import('../seed/seedFleet')).addSeedFleet(migrated);
  }

  if (collections.transportRequests.size > 0) {
    migrated = (await import('./migrateTripRecords')).addTripRecords(migrated);
  }

  return addWarehouseTopologies(migrated);
};
