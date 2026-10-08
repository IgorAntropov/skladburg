import type { OrganizationSettings } from '@skladburg/contracts/organization/v1/organization';
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

export const useOrganizationSettingsQuery = (): UseQueryResult<OrganizationSettings> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId),
    queryFn: organizationId === undefined
      ? skipToken
      : async (): Promise<OrganizationSettings> => {
        const response = await client.organization.getOrganizationSettings({});

        if (response.settings === undefined) {
          throw new Error('GetOrganizationSettings response has no settings');
        }

        return response.settings;
      },
    queryKey: organizationKeys.settings(getOrganizationScope(organizationId)),
  });
};
