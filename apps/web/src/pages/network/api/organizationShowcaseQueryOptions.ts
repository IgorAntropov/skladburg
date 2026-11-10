import type { OrganizationShowcase } from '@skladburg/contracts/organization/v1/showcase';
import type { UndefinedInitialDataOptions } from '@tanstack/react-query';

import { queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '@/shared/api';

import { getOrganizationScope } from '@/shared/api';

import { organizationShowcaseKeys } from './organizationShowcaseKeys';

const SHOWCASE_STALE_TIME_MS = 30_000;

type OrganizationShowcaseKeyValue = ReturnType<typeof organizationShowcaseKeys.detail>;

export const organizationShowcaseQueryOptions = (
  client: ApiClient,
  actingOrganizationId: string | undefined,
  organizationId: string,
): UndefinedInitialDataOptions<OrganizationShowcase, Error, OrganizationShowcase, OrganizationShowcaseKeyValue> => queryOptions({
  enabled: actingOrganizationId !== undefined,
  meta: { channels: [] },
  queryFn: async ({ signal }): Promise<OrganizationShowcase> => {
    const { OrganizationShowcaseService } = await import('@skladburg/contracts/organization/v1/showcase');
    const response = await client.service(OrganizationShowcaseService).getOrganizationShowcase({ organizationId }, { signal });

    if (response.organization === undefined) {
      throw new Error('GetOrganizationShowcase response has no organization');
    }

    return response.organization;
  },
  queryKey: organizationShowcaseKeys.detail(getOrganizationScope(actingOrganizationId), organizationId),
  staleTime: SHOWCASE_STALE_TIME_MS,
});
