import type { MapSite } from '@skladburg/contracts/network/v1/network';

import { NetworkService } from '@skladburg/contracts/network/v1/network';

import type { ApiClient } from '@/shared/api';

import { collectPages } from '@/shared/api';

export const fetchMapSites = (client: ApiClient): Promise<MapSite[]> => collectPages(async (page) => {
  const response = await client.service(NetworkService).listMapSites({ page });

  return { items: response.mapSites, nextPageToken: response.page?.nextPageToken ?? '' };
});
