import type {
  EngineCollectionValue,
  EngineSnapshotValue,
} from '../ports/index';
import type { TableRecordsValue } from '../state/index';

import { TABLE_DEFINITIONS } from '../state/index';
import {
  createSeedFleetRecords,
  type SeedFleetRecordsValue,
} from './seedFleetRecords';

const addRecords = <TName extends keyof SeedFleetRecordsValue>(
  collections: EngineSnapshotValue['collections'],
  name: TName,
  records: readonly TableRecordsValue[TName][],
): EngineCollectionValue => {
  const collection = new Map(collections[name]);
  const definition = TABLE_DEFINITIONS[name];

  for (const record of records) {
    if (!collection.has(record.id) && collections.organizations.has(record.tenantId)) {
      collection.set(record.id, definition.encode(record));
    }
  }

  return collection;
};

export const addSeedFleet = (snapshot: EngineSnapshotValue): EngineSnapshotValue => {
  const { collections } = snapshot;
  const records = createSeedFleetRecords(snapshot.meta.worldTimeMs);

  return {
    ...snapshot,
    collections: {
      ...collections,
      carrierLanes: addRecords(collections, 'carrierLanes', records.carrierLanes),
      drivers: addRecords(collections, 'drivers', records.drivers),
      vehicles: addRecords(collections, 'vehicles', records.vehicles),
    },
  };
};
