import type {
  Listing,
  ListingPrice,
  OwnListing,
  SalesTerms,
} from '@skladburg/contracts/catalog/v1/catalog';

import { useQueryClient } from '@tanstack/react-query';

import { listingKeys } from '@/entities/listing';
import {
  getOrganizationScope,
  useActingContext,
} from '@/shared/api';

export interface ListingCacheValue {
  storeListing: (saved: Listing) => void;
  storePrice: (saved: ListingPrice) => void;
  storeSalesTerms: (saved: SalesTerms) => void;
}

export const useListingCache = (): ListingCacheValue => {
  const queryClient = useQueryClient();
  const { organizationId } = useActingContext();

  const scope = getOrganizationScope(organizationId);

  const storeListing = (saved: Listing): void => {
    console.log('> useListingCache -> storeListing:', { version: String(saved.version) });
    queryClient.setQueryData<OwnListing>(
      listingKeys.ownItem(scope, saved.id),
      current => (current === undefined ? undefined : { ...current, listing: saved }),
    );
  };

  const storePrice = (saved: ListingPrice): void => {
    console.log('> useListingCache -> storePrice:', { version: String(saved.version) });
    queryClient.setQueryData<ListingPrice[]>(listingKeys.prices(scope, [saved.listingId]), [saved]);
  };

  const storeSalesTerms = (saved: SalesTerms): void => {
    console.log('> useListingCache -> storeSalesTerms:', { version: String(saved.version) });
    queryClient.setQueryData<SalesTerms>(listingKeys.salesTerms(scope), saved);
  };

  return { storeListing, storePrice, storeSalesTerms };
};
