import type { QueryClient } from '@tanstack/react-query';

import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';

import type { ApiClient } from '@/shared/api';
import type { WorldClockReadingValue } from '@/widgets/top-bar';

import {
  pickOrganizationLogoPath,
  toOrganizationLogo,
} from '@/entities/organization';
import { readTransportTrips } from '@/entities/transport';
import { isReadAccessDenied } from '@/shared/api';
import {
  createWorldClockQueryOptions,
  projectWorldTime,
} from '@/widgets/top-bar';

import type { NetworkTripListValue } from '../model/networkTripActor';

import { readNetworkMapTrip } from '../model/readNetworkMapTrip';
import { organizationShowcaseQueryOptions } from './organizationShowcaseQueryOptions';

export const readNetworkTrips = async (
  client: ApiClient,
  queryClient: QueryClient,
  organizationId: string,
  signal: AbortSignal,
): Promise<NetworkTripListValue> => {
  const trips = await readTransportTrips(client.service(LogisticsService), signal).catch((error: unknown) => {
    if (error instanceof Error && isReadAccessDenied(error)) {
      return [];
    }

    throw error;
  });
  const mappedTrips = trips.map(readNetworkMapTrip).filter(trip => trip !== undefined);
  if (mappedTrips.length === 0) {
    return { rows: [], scene: undefined };
  }

  const carrierIds = new Set(mappedTrips.map(trip => trip.carrierOrganizationId));
  signal.throwIfAborted();

  const clockOptions = createWorldClockQueryOptions(client);
  const readClock = queryClient.query({ ...clockOptions, staleTime: 0 })
    .catch(() => queryClient.getQueryData<WorldClockReadingValue>(clockOptions.queryKey));
  const readBrands = Promise.all([...carrierIds].map(async (id) => {
    try {
      const showcase = await queryClient.query(organizationShowcaseQueryOptions(client, organizationId, id));

      return [id, showcase] as const;
    }
    catch {
      return [id, undefined] as const;
    }
  }));
  const [clock, brandEntries] = await Promise.all([readClock, readBrands]);
  const brands = new Map(brandEntries);
  signal.throwIfAborted();

  const rows = mappedTrips.map(({ actor, carrierOrganizationId, status }) => {
    const brand = brands.get(carrierOrganizationId);

    return {
      ...actor,
      brandLabel: brand?.name ?? '',
      brandLogoPath: pickOrganizationLogoPath(toOrganizationLogo(brand?.logo), 'light'),
      status,
    };
  });

  const scene = clock === undefined
    ? undefined
    : {
        actors: rows,
        readWorldTimeMs: (): number => projectWorldTime(clock.snapshot, clock.receivedAtMs, performance.now()),
      };

  return { rows, scene };
};
