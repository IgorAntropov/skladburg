import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
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

import { warehouseKeys } from './warehouseKeys';

const NO_ORGANIZATION_SCOPE = 'none';

const createWarehousesMeta = (organizationId: string | undefined): ApiQueryMetaValue => ({
  channels: organizationId === undefined ? [] : [organizationChannel(organizationId)],
});

export const useWarehousesQuery = (): UseQueryResult<readonly Warehouse[]> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  return useQuery({
    meta: createWarehousesMeta(organizationId),
    queryFn: organizationId === undefined
      ? skipToken
      : async (): Promise<readonly Warehouse[]> => {
        const response = await client.organization.listWarehouses({});

        return response.warehouses;
      },
    queryKey: warehouseKeys.list(organizationId ?? NO_ORGANIZATION_SCOPE),
  });
};
