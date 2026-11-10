import type { UseQueryResult } from '@tanstack/react-query';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  skipToken,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  isPermissionGranted,
  useSessionQuery,
} from '@/entities/session';
import {
  TRANSPORT_EVENTS,
  transportScope,
} from '@/entities/transport';
import {
  createOrganizationQueryMeta,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import type { NetworkTripListValue } from '../model/networkTripActor';

export interface NetworkTripsStateValue {
  canView: boolean;
  query: UseQueryResult<NetworkTripListValue>;
}

export const useNetworkTrips = (): NetworkTripsStateValue => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { organizationId, userId } = useActingContext();
  const { data: session } = useSessionQuery();

  const canRead = organizationId !== undefined && userId !== undefined && session !== undefined
    && isPermissionGranted(session.permissions, PermissionCode.TRIP_VIEW, { kind: 'organization' });

  const query = useQuery({
    meta: createOrganizationQueryMeta(organizationId, TRANSPORT_EVENTS),
    queryFn: canRead
      ? async ({ signal }): Promise<NetworkTripListValue> => {
        const { readNetworkTrips } = await import('./readNetworkTrips');

        return readNetworkTrips(client, queryClient, organizationId, signal);
      }
      : skipToken,
    queryKey: [...transportScope(organizationId, userId), 'network-trips'],
    refetchOnWindowFocus: true,
  });

  return { canView: canRead, query };
};
