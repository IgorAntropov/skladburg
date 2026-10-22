import type { OrganizationShowcase } from '@skladburg/contracts/organization/v1/showcase';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  keepPreviousData,
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import type { OrganizationDirectoryFilterValue } from '../../model/organizationDirectoryFilter';

import { fetchOrganizationShowcases } from './fetchOrganizationShowcases';
import { organizationShowcaseKeys } from './organizationShowcaseKeys';

const SHOWCASE_STALE_TIME_MS = 30_000;

export const useOrganizationShowcasesQuery = (
  filter: OrganizationDirectoryFilterValue,
): UseQueryResult<readonly OrganizationShowcase[]> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  return useQuery({
    meta: { channels: [] },
    placeholderData: keepPreviousData,
    queryFn: organizationId === undefined
      ? skipToken
      : (): Promise<readonly OrganizationShowcase[]> => fetchOrganizationShowcases(client, filter),
    queryKey: organizationShowcaseKeys.list(getOrganizationScope(organizationId), filter),
    staleTime: SHOWCASE_STALE_TIME_MS,
  });
};
