import type { DemoScenarioValue } from '../../protocol/demoScenario';
import type { EngineSnapshotValue } from '../ports/index';

import { addSeedWarehouseEquipment } from '../seed/seedWarehouseEquipment';
import { ENGINE_SCHEMA_VERSION } from '../state/schemaVersion';
import { addWarehouseStaff } from './migrateWarehouseStaff';
import { addWarehouseTopologies } from './migrateWarehouseTopologies';

const PRE_FLEET_SCHEMA_VERSION = 15;
const PRE_TRIPS_SCHEMA_VERSION = 17;
const PRE_TOPOLOGY_SCHEMA_VERSION = 18;
const PRE_STOCK_SCHEMA_VERSION = 19;
const PRE_WAREHOUSE_IMPORT_SCHEMA_VERSION = 20;
const PRE_WAREHOUSE_OUTBOUND_SCHEMA_VERSION = 21;
const PRE_WAREHOUSE_INBOUND_SCHEMA_VERSION = 22;
const PRE_RECEIPT_SETTLEMENT_SCHEMA_VERSION = 23;
const PRE_WAREHOUSE_LAYOUT_SESSIONS_SCHEMA_VERSION = 24;
const PRE_WAREHOUSE_LAYOUT_DRAFTS_SCHEMA_VERSION = 25;
const PRE_YARD_QUEUE_POLICY_SCHEMA_VERSION = 26;
const PRE_YARD_DISPATCH_SCHEMA_VERSION = 27;
const PRE_WAREHOUSE_EQUIPMENT_SCHEMA_VERSION = 29;

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

const migrateWarehouseState = async (stored: EngineSnapshotValue): Promise<EngineSnapshotValue> => {
  if (stored.schemaVersion === 28) {
    return { ...stored, schemaVersion: ENGINE_SCHEMA_VERSION };
  }
  const withYardDispatchEntries: EngineSnapshotValue = {
    ...stored,
    collections: { ...stored.collections, yardDispatchEntries: new Map() },
    schemaVersion: ENGINE_SCHEMA_VERSION,
  };
  if (stored.schemaVersion === PRE_YARD_DISPATCH_SCHEMA_VERSION) {
    return withYardDispatchEntries;
  }

  const withYardQueuePolicies: EngineSnapshotValue = {
    ...withYardDispatchEntries,
    collections: { ...withYardDispatchEntries.collections, yardQueuePolicies: new Map() },
  };
  if (stored.schemaVersion === PRE_WAREHOUSE_LAYOUT_DRAFTS_SCHEMA_VERSION
    || stored.schemaVersion === PRE_YARD_QUEUE_POLICY_SCHEMA_VERSION) {
    return withYardQueuePolicies;
  }

  const current: EngineSnapshotValue = {
    ...withYardQueuePolicies,
    collections: { ...withYardQueuePolicies.collections, warehouseLayoutSessions: new Map() },
  };

  if (stored.schemaVersion === PRE_WAREHOUSE_LAYOUT_SESSIONS_SCHEMA_VERSION) {
    return current;
  }

  if (stored.schemaVersion === PRE_RECEIPT_SETTLEMENT_SCHEMA_VERSION) {
    if (stored.collections.warehouseInbound.size === 0) {
      return current;
    }
    const { migrateReceiptDocuments } = await import('./migrateReceiptDocuments');
    return migrateReceiptDocuments(current);
  }

  const snapshot: EngineSnapshotValue = {
    ...current,
    collections: { ...current.collections, warehouseInbound: new Map() },
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

export const migrateStoredSnapshot = async (
  stored: EngineSnapshotValue,
  scenario: DemoScenarioValue | undefined,
): Promise<EngineSnapshotValue> => {
  const snapshot = { ...stored, collections: { ...stored.collections, warehouseSensorAlerts: new Map() } };
  if (snapshot.schemaVersion === 30) {
    return { ...snapshot, schemaVersion: ENGINE_SCHEMA_VERSION };
  }
  const world = snapshot.schemaVersion === PRE_WAREHOUSE_EQUIPMENT_SCHEMA_VERSION
    ? { ...snapshot, schemaVersion: ENGINE_SCHEMA_VERSION }
    : addWarehouseStaff(await migrateWarehouseState(snapshot));
  return addSeedWarehouseEquipment(world, scenario);
};
