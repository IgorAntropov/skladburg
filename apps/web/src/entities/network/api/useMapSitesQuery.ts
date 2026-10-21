import type { MapSite } from '@skladburg/contracts/network/v1/network';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  createOrganizationQueryMeta,
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { fetchMapSites } from './fetchMapSites';
import { networkKeys } from './networkKeys';

export const useMapSitesQuery = (): UseQueryResult<readonly MapSite[]> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId),
    queryFn: organizationId === undefined ? skipToken : (): Promise<readonly MapSite[]> => fetchMapSites(client),
    queryKey: networkKeys.mapSites(getOrganizationScope(organizationId)),
  });
};
