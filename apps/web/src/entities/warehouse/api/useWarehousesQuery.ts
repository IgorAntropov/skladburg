import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type { UseQueryResult } from '@tanstack/react-query';

import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  collectPages,
  createOrganizationQueryMeta,
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { warehouseKeys } from './warehouseKeys';

export const useWarehousesQuery = (): UseQueryResult<readonly Warehouse[]> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId),
    queryFn: organizationId === undefined
      ? skipToken
      : (): Promise<readonly Warehouse[]> => collectPages(async (page) => {
          const response = await client.service(OrganizationService).listWarehouses({ page });

          return { items: response.warehouses, nextPageToken: response.page?.nextPageToken ?? '' };
        }),
    queryKey: warehouseKeys.list(getOrganizationScope(organizationId)),
  });
};
