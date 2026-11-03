import type { ListingPrice } from '@skladburg/contracts/catalog/v1/catalog';
import type { UseQueryResult } from '@tanstack/react-query';

import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  collectPages,
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { listingKeys } from './listingKeys';
import { createOwnListingQueryMeta } from './listingQueryMeta';

export type ListingPricesByIdValue = ReadonlyMap<string, ListingPrice>;

const toPricesById = (prices: readonly ListingPrice[]): ListingPricesByIdValue => (
  new Map(prices.map((price): [string, ListingPrice] => [price.listingId, price]))
);

export const useListingPricesQuery = (listingIds: readonly string[]): UseQueryResult<ListingPricesByIdValue> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  const isRequested = organizationId !== undefined && listingIds.length > 0;

  return useQuery({
    meta: createOwnListingQueryMeta(organizationId),
    queryFn: isRequested
      ? (): Promise<ListingPrice[]> => collectPages(async (page) => {
          const response = await client.service(CatalogService).listListingPrices({ listingIds: [...listingIds], page });

          return { items: response.prices, nextPageToken: response.page?.nextPageToken ?? '' };
        })
      : skipToken,
    queryKey: listingKeys.prices(getOrganizationScope(organizationId), listingIds),
    select: toPricesById,
  });
};
