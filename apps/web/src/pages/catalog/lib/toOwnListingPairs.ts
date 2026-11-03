import type {
  Listing,
  OwnListing,
  Product,
} from '@skladburg/contracts/catalog/v1/catalog';

export interface OwnListingPairValue {
  listing: Listing;
  product: Product;
}

export const toOwnListingPair = (ownListing: OwnListing): OwnListingPairValue | undefined => (
  ownListing.listing === undefined || ownListing.product === undefined
    ? undefined
    : { listing: ownListing.listing, product: ownListing.product }
);

export const toOwnListingPairs = (ownListings: readonly OwnListing[]): readonly OwnListingPairValue[] => (
  ownListings.flatMap((ownListing) => {
    const pair = toOwnListingPair(ownListing);

    return pair === undefined ? [] : [pair];
  })
);
