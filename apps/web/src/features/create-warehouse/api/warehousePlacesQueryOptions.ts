import type { UndefinedInitialDataOptions } from '@tanstack/react-query';

import { queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '@/shared/api';

import type { WarehousePlacesValue } from '../model/warehousePlacesTypes';

import { networkKeys } from './networkKeys';

type WarehousePlacesQueryKeyValue = ReturnType<typeof networkKeys.warehousePlaces>;

export const createWarehousePlacesQueryOptions = (
  client: ApiClient,
): UndefinedInitialDataOptions<WarehousePlacesValue, Error, WarehousePlacesValue, WarehousePlacesQueryKeyValue> => queryOptions({
  meta: { channels: [] },
  queryFn: async (): Promise<WarehousePlacesValue> => {
    const [citiesResponse, mapNodesResponse] = await Promise.all([
      client.network.listCities({}),
      client.network.listMapNodes({}),
    ]);

    return { cities: citiesResponse.cities, mapNodes: mapNodesResponse.mapNodes };
  },
  queryKey: networkKeys.warehousePlaces(),
  staleTime: Infinity,
});
