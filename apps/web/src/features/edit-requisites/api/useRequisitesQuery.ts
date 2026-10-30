import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';
import type { UseQueryResult } from '@tanstack/react-query';

import { OrganizationRequisitesService } from '@skladburg/contracts/organization/v1/requisites';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  createOrganizationQueryMeta,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { useRequisitesQueryKey } from './useRequisitesQueryKey';

export const useRequisitesQuery = (): UseQueryResult<OrganizationRequisites> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();
  const queryKey = useRequisitesQueryKey();

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId),
    queryFn: organizationId === undefined
      ? skipToken
      : async (): Promise<OrganizationRequisites> => {
        const response = await client.service(OrganizationRequisitesService).getOrganizationRequisites({});

        if (response.requisites === undefined) {
          throw new Error('GetOrganizationRequisites response has no requisites');
        }

        return response.requisites;
      },
    queryKey,
  });
};
