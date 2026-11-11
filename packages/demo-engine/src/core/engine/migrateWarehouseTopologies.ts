import type { EngineSnapshotValue } from '../ports/index';

import { createSeedWarehouseTopologies } from '../seed/seedWarehouseTopologies';
import {
  ENGINE_SCHEMA_VERSION,
  TABLE_DEFINITIONS,
} from '../state/index';

export const addWarehouseTopologies = (snapshot: EngineSnapshotValue): EngineSnapshotValue => {
  const records = createSeedWarehouseTopologies((id) => {
    const stored = snapshot.collections.warehouses.get(id);

    return stored === undefined ? undefined : TABLE_DEFINITIONS.warehouses.decode(stored);
  });
  const table = TABLE_DEFINITIONS.warehouseTopologies;
  const warehouseTopologies = new Map(records.map(record => [record.id, table.encode(record)]));

  return { ...snapshot, collections: { ...snapshot.collections, warehouseTopologies }, schemaVersion: ENGINE_SCHEMA_VERSION };
};
