import type { Client } from '@connectrpc/connect';
import type {
  LogisticsService,
  TransportOfferCandidate,
  TransportRequest,
  Trip,
} from '@skladburg/contracts/logistics/v1/logistics';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  skipToken,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  collectPages,
  createOrganizationQueryMeta,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import {
  TRANSPORT_EVENTS,
  transportScope,
} from './transportQueryScope';

const LIVE_TRIP_REFRESH_MS = 15_000;

type ReadTransportValue<TData> = (service: Client<typeof LogisticsService>, signal: AbortSignal) => Promise<TData>;

const useTransportQuery = <TData>(
  key: readonly string[],
  isEnabled: boolean,
  read: ReadTransportValue<TData>,
  refetchInterval?: ((data: TData | undefined) => false | number),
): UseQueryResult<TData> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const canLoad = isEnabled && organizationId !== undefined && userId !== undefined;

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId, TRANSPORT_EVENTS),
    queryFn: canLoad
      ? async ({ signal }): Promise<TData> => {
        const { LogisticsService } = await import('@skladburg/contracts/logistics/v1/logistics');
        return read(client.service(LogisticsService), signal);
      }
      : skipToken,
    queryKey: [...transportScope(organizationId, userId), ...key],
    refetchInterval: refetchInterval === undefined ? false : query => refetchInterval(query.state.data),
    refetchIntervalInBackground: false,
  });
};

export const useTransportRequests = (isEnabled: boolean): UseQueryResult<TransportRequest[]> =>
  useTransportQuery(['requests'], isEnabled, (service, signal) => collectPages(async (page) => {
    const response = await service.listTransportRequests({ page }, { signal });
    return { items: response.transportRequests, nextPageToken: response.page?.nextPageToken ?? '' };
  }));

export const useTransportRequest = (id: string | undefined, isEnabled: boolean): UseQueryResult<TransportRequest> =>
  useTransportQuery(['request', id ?? ''], isEnabled && id !== undefined, async (service, signal) => {
    const { transportRequest } = await service.getTransportRequest({ transportRequestId: id }, { signal });
    if (transportRequest === undefined) {
      throw new Error('GetTransportRequest response has no request');
    }

    return transportRequest;
  });

export const useTransportOffers = (id: string | undefined, isEnabled: boolean): UseQueryResult<TransportOfferCandidate[]> =>
  useTransportQuery(['offers', id ?? ''], isEnabled && id !== undefined, (service, signal) => collectPages(async (page) => {
    const response = await service.listTransportOffers({ page, transportRequestId: id }, { signal });
    return { items: response.candidates, nextPageToken: response.page?.nextPageToken ?? '' };
  }));

export const readTransportTrips: ReadTransportValue<Trip[]> = (service, signal) => collectPages(async (page) => {
  const response = await service.listTrips({ page }, { signal });
  return { items: response.trips, nextPageToken: response.page?.nextPageToken ?? '' };
});

export const useTrips = (isEnabled: boolean): UseQueryResult<Trip[]> => useTransportQuery(['trips'], isEnabled, readTransportTrips);

const refreshWhileMeasuring = (trip: Trip | undefined): false | number =>
  trip?.bodyTemperature !== undefined && trip.arrivedAt === undefined ? LIVE_TRIP_REFRESH_MS : false;

export const useTrip = (id: string | undefined, isEnabled: boolean, isLive = false): UseQueryResult<Trip> =>
  useTransportQuery(['trip', id ?? ''], isEnabled && id !== undefined, async (service, signal) => {
    const { trip } = await service.getTrip({ tripId: id }, { signal });
    if (trip === undefined) {
      throw new Error('GetTrip response has no trip');
    }

    return trip;
  }, isLive ? refreshWhileMeasuring : undefined);

export const useRefreshTransport = (): (() => Promise<void>) => {
  const queryClient = useQueryClient();
  const { organizationId, userId } = useActingContext();

  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: transportScope(organizationId, userId) }),
    [organizationId, queryClient, userId],
  );
};
