import type { MapSite } from '@skladburg/contracts/network/v1/network';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import type { RealtimeEventCaseValue } from '@/shared/api';

import {
  createOrganizationQueryMeta,
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { fetchMapSites } from './fetchMapSites';
import { networkKeys } from './networkKeys';

const MAP_SITE_EVENT_CASES: readonly RealtimeEventCaseValue[] = ['warehouseChanged', 'warehouseCreated'];

export const useMapSitesQuery = (): UseQueryResult<readonly MapSite[]> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId, MAP_SITE_EVENT_CASES),
    queryFn: organizationId === undefined ? skipToken : (): Promise<readonly MapSite[]> => fetchMapSites(client),
    queryKey: networkKeys.mapSites(getOrganizationScope(organizationId)),
  });
};
