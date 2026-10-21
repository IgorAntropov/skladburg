import type { MapSite } from '@skladburg/contracts/network/v1/network';
import type { UseQueryResult } from '@tanstack/react-query';

import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import type { ApiQueryMetaValue } from '@/shared/api';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { fetchMapSites } from './fetchMapSites';
import { networkKeys } from './networkKeys';

const NO_ORGANIZATION_SCOPE = 'none';

const createMapSitesMeta = (organizationId: string | undefined): ApiQueryMetaValue => ({
  channels: organizationId === undefined ? [] : [organizationChannel(organizationId)],
});

export const useMapSitesQuery = (): UseQueryResult<readonly MapSite[]> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  return useQuery({
    meta: createMapSitesMeta(organizationId),
    queryFn: organizationId === undefined ? skipToken : (): Promise<readonly MapSite[]> => fetchMapSites(client),
    queryKey: networkKeys.mapSites(organizationId ?? NO_ORGANIZATION_SCOPE),
  });
};
