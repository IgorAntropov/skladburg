import type { OrganizationShowcase } from '@skladburg/contracts/organization/v1/showcase';
import type { UseQueryResult } from '@tanstack/react-query';

import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { organizationShowcaseKeys } from './organizationShowcaseKeys';

const SHOWCASE_STALE_TIME_MS = 30_000;

export const useOrganizationShowcaseQuery = (organizationId: string): UseQueryResult<OrganizationShowcase> => {
  const client = useApiClient();
  const { organizationId: actingOrganizationId } = useActingContext();

  return useQuery({
    meta: { channels: [] },
    queryFn: actingOrganizationId === undefined
      ? skipToken
      : async (): Promise<OrganizationShowcase> => {
        const response = await client.service(OrganizationShowcaseService).getOrganizationShowcase({ organizationId });

        if (response.organization === undefined) {
          throw new Error('GetOrganizationShowcase response has no organization');
        }

        return response.organization;
      },
    queryKey: organizationShowcaseKeys.detail(getOrganizationScope(actingOrganizationId), organizationId),
    staleTime: SHOWCASE_STALE_TIME_MS,
  });
};
