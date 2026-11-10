import type { OrganizationShowcase } from '@skladburg/contracts/organization/v1/showcase';
import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { organizationShowcaseQueryOptions } from '../organizationShowcaseQueryOptions';

export const useOrganizationShowcaseQuery = (organizationId: string): UseQueryResult<OrganizationShowcase> => {
  const client = useApiClient();
  const { organizationId: actingOrganizationId } = useActingContext();

  return useQuery(organizationShowcaseQueryOptions(client, actingOrganizationId, organizationId));
};
