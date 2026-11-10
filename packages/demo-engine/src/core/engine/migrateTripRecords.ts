import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';

import type {
  EngineSnapshotValue,
  StoredRecordValue,
} from '../ports/index';

import { buildTripRecord } from '../modules/logistics/tripRecords';
import {
  createEngineState,
  TABLE_DEFINITIONS,
} from '../state/index';

export const addTripRecords = (snapshot: EngineSnapshotValue): EngineSnapshotValue => {
  const { read } = createEngineState(snapshot);
  const trips = new Map<string, StoredRecordValue>();
  const dealIds = new Set<string>();

  for (const request of read.list('transportRequests')) {
    if (request.status !== TransportRequestStatus.SELECTED) {
      continue;
    }
    const offer = read.get('transportOffers', request.selectedOfferId);
    const trip = offer === undefined ? undefined : buildTripRecord(read, request, offer);
    if (trip === undefined || dealIds.has(trip.dealId)) {
      throw new Error('A selected transport request cannot be restored as a trip');
    }

    dealIds.add(trip.dealId);
    trips.set(trip.id, TABLE_DEFINITIONS.trips.encode(trip));
  }

  return { ...snapshot, collections: { ...snapshot.collections, trips } };
};
