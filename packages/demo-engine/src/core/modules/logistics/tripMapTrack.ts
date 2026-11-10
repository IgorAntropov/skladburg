import type { TripMapTrack } from '@skladburg/contracts/logistics/v1/logistics';
import type {
  TransportOrder,
  TripAssignment,
} from '@skladburg/contracts/logistics/v1/trip_records';

import { create } from '@bufbuild/protobuf';
import { TripMapTrackSchema } from '@skladburg/contracts/logistics/v1/logistics';

import type { IStateReader } from '../../state/index';
import type { RouteValue } from '../network/index';

import { findInterWarehouseRoutes } from '../network/index';

export type ReadTripMapTrack = (order: TransportOrder, assignment: TripAssignment | undefined) => TripMapTrack | undefined;

export const createTripMapTrackReader = (read: IStateReader): ReadTripMapTrack => {
  const routesByDestination = new Map<string, ReadonlyMap<string, RouteValue>>();

  return ({ carrierOrganizationId, delivery, pickup }, assignment): TripMapTrack | undefined => {
    if (assignment === undefined || pickup === undefined || delivery === undefined) {
      return undefined;
    }

    let routes = routesByDestination.get(delivery.mapNodeId);
    if (routes === undefined) {
      routes = findInterWarehouseRoutes(read, delivery);
      routesByDestination.set(delivery.mapNodeId, routes);
    }
    const route = routes.get(pickup.mapNodeId);
    if (route === undefined) {
      return undefined;
    }

    return create(TripMapTrackSchema, {
      carrierOrganizationId,
      registrationNumber: assignment.registrationNumber,
      routeLegIds: [...route.legIds].reverse(),
    });
  };
};
