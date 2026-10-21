import { NetworkService } from '@skladburg/contracts/network/v1/network';

import type { ApiClient } from '@/shared/api';

import type { NetworkDirectoryValue } from '../model/networkMapTypes';

import { collectPages } from '../lib/collectPages';

export const fetchNetworkDirectory = async (client: ApiClient): Promise<NetworkDirectoryValue> => {
  const [cities, mapNodes, routeLegs] = await Promise.all([
    collectPages(async (page) => {
      const response = await client.service(NetworkService).listCities({ page });

      return { items: response.cities, nextPageToken: response.page?.nextPageToken ?? '' };
    }),
    collectPages(async (page) => {
      const response = await client.service(NetworkService).listMapNodes({ page });

      return { items: response.mapNodes, nextPageToken: response.page?.nextPageToken ?? '' };
    }),
    collectPages(async (page) => {
      const response = await client.service(NetworkService).listRouteLegs({ page });

      return { items: response.routeLegs, nextPageToken: response.page?.nextPageToken ?? '' };
    }),
  ]);

  return { cities, mapNodes, routeLegs };
};
