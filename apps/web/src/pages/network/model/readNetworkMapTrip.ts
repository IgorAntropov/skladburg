import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';

import type { NetworkTripActorValue } from './networkTripActor';

export interface NetworkMapTripValue {
  actor: Omit<NetworkTripActorValue, 'brandLabel' | 'brandLogoPath'>;
  carrierOrganizationId: string;
  status: TripStatus;
}

const PHASES: Partial<Record<TripStatus, NetworkTripActorValue['phase']>> = {
  [TripStatus.ARRIVED]: 'arrived',
  [TripStatus.DELIVERED]: 'arrived',
  [TripStatus.IN_TRANSIT]: 'moving',
  [TripStatus.LOADED]: 'loading',
};

export const readNetworkMapTrip = (trip: Trip): NetworkMapTripValue | undefined => {
  const { delivery, id, mapTrack, pickup, status } = trip;
  const departure = trip.departedAt ?? trip.plannedDepartureAt;
  const arrival = trip.arrivedAt ?? trip.plannedArrivalAt;
  const phase = PHASES[status];

  if (mapTrack === undefined || pickup === undefined || delivery === undefined || departure === undefined || arrival === undefined
    || phase === undefined || pickup.mapNodeId === '' || delivery.mapNodeId === ''
    || pickup.warehouseId === '' || delivery.warehouseId === '') {
    return undefined;
  }

  const departureAtMs = timestampMs(departure);
  const arrivalAtMs = timestampMs(arrival);
  if (arrivalAtMs <= departureAtMs) {
    return undefined;
  }

  return {
    actor: {
      arrivalAtMs,
      deliverySiteId: delivery.warehouseId,
      departureAtMs,
      fromNodeId: pickup.mapNodeId,
      id,
      phase,
      pickupSiteId: pickup.warehouseId,
      registrationNumber: mapTrack.registrationNumber,
      routeLegIds: mapTrack.routeLegIds,
      toNodeId: delivery.mapNodeId,
    },
    carrierOrganizationId: mapTrack.carrierOrganizationId,
    status,
  };
};
