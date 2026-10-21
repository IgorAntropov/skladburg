import type { ApiClient } from '@/shared/api';

import type { NetworkDirectoryValue } from '../model/networkMapTypes';

import { collectPages } from '../lib/collectPages';

export const fetchNetworkDirectory = async (client: ApiClient): Promise<NetworkDirectoryValue> => {
  const [cities, mapNodes, routeLegs] = await Promise.all([
    collectPages(async (page) => {
      const response = await client.network.listCities({ page });

      return { items: response.cities, nextPageToken: response.page?.nextPageToken ?? '' };
    }),
    collectPages(async (page) => {
      const response = await client.network.listMapNodes({ page });

      return { items: response.mapNodes, nextPageToken: response.page?.nextPageToken ?? '' };
    }),
    collectPages(async (page) => {
      const response = await client.network.listRouteLegs({ page });

      return { items: response.routeLegs, nextPageToken: response.page?.nextPageToken ?? '' };
    }),
  ]);

  return { cities, mapNodes, routeLegs };
};
