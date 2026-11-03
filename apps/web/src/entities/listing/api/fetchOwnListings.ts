import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';

import type { ApiClient } from '@/shared/api';

import type { OwnListingsPageValue } from './listingTypes';

export const OWN_LISTINGS_PAGE_SIZE = 30;

export const fetchOwnListings = async (
  client: ApiClient,
  query: string,
  pageToken: string,
): Promise<OwnListingsPageValue> => {
  const response = await client.service(CatalogService).listOwnListings({
    page: { pageSize: OWN_LISTINGS_PAGE_SIZE, pageToken },
    query,
  });

  return { items: response.listings, nextPageToken: response.page?.nextPageToken ?? '' };
};
