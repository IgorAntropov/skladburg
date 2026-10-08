import type { Organization } from '@skladburg/contracts/organization/v1/organization';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { organizationKeys } from './organizationKeys';
import {
  createOrganizationQueryMeta,
  getOrganizationScope,
} from './organizationScope';

export const useActingOrganizationQuery = (): UseQueryResult<Organization> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId),
    queryFn: organizationId === undefined
      ? skipToken
      : async (): Promise<Organization> => {
        const response = await client.organization.getOrganization({ organizationId });

        if (response.organization === undefined) {
          throw new Error('GetOrganization response has no organization');
        }

        return response.organization;
      },
    queryKey: organizationKeys.detail(getOrganizationScope(organizationId)),
  });
};
