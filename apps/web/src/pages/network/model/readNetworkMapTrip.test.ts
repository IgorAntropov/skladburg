import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { TripSchema } from '@skladburg/contracts/logistics/v1/logistics';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { readNetworkMapTrip } from './readNetworkMapTrip';

const trip = (status: TripStatus): Trip => create(TripSchema, {
  delivery: { mapNodeId: 'destination-node', warehouseId: 'destination-warehouse' },
  id: 'trip',
  mapTrack: { carrierOrganizationId: 'carrier', registrationNumber: 'А001АА', routeLegIds: ['first', 'last'] },
  pickup: { mapNodeId: 'origin-node', warehouseId: 'origin-warehouse' },
  plannedArrivalAt: timestampFromMs(30_000),
  plannedDepartureAt: timestampFromMs(10_000),
  status,
});

describe('readNetworkMapTrip', () => {
  it.each([
    [TripStatus.LOADED, 'loading'],
    [TripStatus.IN_TRANSIT, 'moving'],
    [TripStatus.ARRIVED, 'arrived'],
    [TripStatus.DELIVERED, 'arrived'],
  ])('maps status %s to phase %s', (status, phase) => {
    expect(readNetworkMapTrip(trip(status))).toMatchObject({
      actor: {
        arrivalAtMs: 30_000,
        deliverySiteId: 'destination-warehouse',
        departureAtMs: 10_000,
        fromNodeId: 'origin-node',
        id: 'trip',
        phase,
        pickupSiteId: 'origin-warehouse',
        registrationNumber: 'А001АА',
        routeLegIds: ['first', 'last'],
        toNodeId: 'destination-node',
      },
      carrierOrganizationId: 'carrier',
      status,
    });
  });

  it('uses actual times when available', () => {
    const arrived = trip(TripStatus.ARRIVED);
    arrived.departedAt = timestampFromMs(11_000);
    arrived.arrivedAt = timestampFromMs(32_000);

    expect(readNetworkMapTrip(arrived)?.actor).toMatchObject({ arrivalAtMs: 32_000, departureAtMs: 11_000 });
  });

  it.each([TripStatus.ASSIGNED, TripStatus.CLOSED, TripStatus.CANCELLED])('omits status %s', (status) => {
    expect(readNetworkMapTrip(trip(status))).toBeUndefined();
  });

  it('omits projections without track, points or usable times', () => {
    const active = trip(TripStatus.IN_TRANSIT);

    expect(readNetworkMapTrip({ ...active, mapTrack: undefined })).toBeUndefined();
    expect(readNetworkMapTrip({ ...active, pickup: undefined })).toBeUndefined();
    expect(readNetworkMapTrip({ ...active, plannedArrivalAt: timestampFromMs(10_000) })).toBeUndefined();
  });
});
