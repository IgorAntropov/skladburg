import { ShowcaseService } from '@skladburg/contracts/catalog/v1/showcase';

import type { ApiClient } from '@/shared/api';

import type {
  ShowcaseListParamsValue,
  ShowcasePageValue,
} from './listingTypes';

export const SHOWCASE_PAGE_SIZE = 30;

export const fetchShowcaseListings = async (
  client: ApiClient,
  params: ShowcaseListParamsValue,
  pageToken: string,
): Promise<ShowcasePageValue> => {
  const response = await client.service(ShowcaseService).listShowcaseListings({
    page: { pageSize: SHOWCASE_PAGE_SIZE, pageToken },
    query: params.query,
    sphereId: params.sphereId,
    toWarehouseId: params.toWarehouseId,
  });

  return { items: response.listings, nextPageToken: response.page?.nextPageToken ?? '' };
};
