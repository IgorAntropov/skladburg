import type { EngineSnapshotValue } from '../ports/index';

import { ENGINE_SCHEMA_VERSION } from '../state/schemaVersion';
import { addWarehouseTopologies } from './migrateWarehouseTopologies';

const PRE_FLEET_SCHEMA_VERSION = 15;
const PRE_TRIPS_SCHEMA_VERSION = 17;
const PRE_TOPOLOGY_SCHEMA_VERSION = 18;
const PRE_STOCK_SCHEMA_VERSION = 19;
const PRE_WAREHOUSE_IMPORT_SCHEMA_VERSION = 20;
const PRE_WAREHOUSE_OUTBOUND_SCHEMA_VERSION = 21;
const PRE_WAREHOUSE_INBOUND_SCHEMA_VERSION = 22;

const addStockCollections = (snapshot: EngineSnapshotValue): EngineSnapshotValue => ({
  ...snapshot,
  collections: {
    ...snapshot.collections,
    stockBalances: new Map(),
    stockBatches: new Map(),
    stockMovements: new Map(),
    warehouseOutbound: new Map(),
  },
});

export const migrateStoredSnapshot = async (stored: EngineSnapshotValue): Promise<EngineSnapshotValue> => {
  const snapshot: EngineSnapshotValue = {
    ...stored,
    collections: { ...stored.collections, warehouseInbound: new Map() },
    schemaVersion: ENGINE_SCHEMA_VERSION,
  };

  if (stored.schemaVersion === PRE_WAREHOUSE_INBOUND_SCHEMA_VERSION) {
    return snapshot;
  }

  if (stored.schemaVersion === PRE_WAREHOUSE_IMPORT_SCHEMA_VERSION || stored.schemaVersion === PRE_WAREHOUSE_OUTBOUND_SCHEMA_VERSION) {
    return { ...snapshot, collections: { ...snapshot.collections, warehouseOutbound: new Map() } };
  }

  if (stored.schemaVersion === PRE_STOCK_SCHEMA_VERSION) {
    return addStockCollections(snapshot);
  }

  if (stored.schemaVersion === PRE_TOPOLOGY_SCHEMA_VERSION) {
    return addStockCollections(addWarehouseTopologies(snapshot));
  }

  const collections = stored.schemaVersion === PRE_TRIPS_SCHEMA_VERSION
    ? snapshot.collections
    : { ...snapshot.collections, transportOffers: new Map(), transportRequests: new Map() };
  let migrated: EngineSnapshotValue = {
    ...snapshot,
    collections: { ...collections, trips: new Map(), warehouseTopologies: new Map() },
  };

  if (stored.schemaVersion === PRE_FLEET_SCHEMA_VERSION) {
    migrated = (await import('../seed/seedFleet')).addSeedFleet(migrated);
  }

  if (collections.transportRequests.size > 0) {
    migrated = (await import('./migrateTripRecords')).addTripRecords(migrated);
  }

  return addStockCollections(addWarehouseTopologies(migrated));
};
