import type { OrganizationSettings } from '@skladburg/contracts/organization/v1/organization';
import type { UseQueryResult } from '@tanstack/react-query';

import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
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

import { organizationKeys } from './organizationKeys';

export const useOrganizationSettingsQuery = (): UseQueryResult<OrganizationSettings> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId),
    queryFn: organizationId === undefined
      ? skipToken
      : async (): Promise<OrganizationSettings> => {
        const response = await client.service(OrganizationService).getOrganizationSettings({});

        if (response.settings === undefined) {
          throw new Error('GetOrganizationSettings response has no settings');
        }

        return response.settings;
      },
    queryKey: organizationKeys.settings(getOrganizationScope(organizationId)),
  });
};
