import { create } from '@bufbuild/protobuf';
import { ListingPriceSchema } from '@skladburg/contracts/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveRowPrice } from './resolveRowPrice';

const LISTING_ID = 'listing-1';
const PRICE = create(ListingPriceSchema, { listingId: LISTING_ID });

describe('resolveRowPrice', () => {
  it('hides the price from a role that may not see price lists', () => {
    expect(resolveRowPrice({ canViewPrices: false, isFailed: false, listingId: LISTING_ID, prices: new Map() }))
      .toEqual({ kind: 'hidden' });
  });

  it('hides the price while its request has failed', () => {
    expect(resolveRowPrice({ canViewPrices: true, isFailed: true, listingId: LISTING_ID, prices: undefined }))
      .toEqual({ kind: 'hidden' });
  });

  it('waits for the prices of the page', () => {
    expect(resolveRowPrice({ canViewPrices: true, isFailed: false, listingId: LISTING_ID, prices: undefined }))
      .toEqual({ kind: 'pending' });
  });

  it('gives the price of the listing once the page has its prices', () => {
    expect(resolveRowPrice({ canViewPrices: true, isFailed: false, listingId: LISTING_ID, prices: new Map([[LISTING_ID, PRICE]]) }))
      .toEqual({ kind: 'ready', price: PRICE });
  });

  it('marks a listing without a price row as ready without a price', () => {
    expect(resolveRowPrice({ canViewPrices: true, isFailed: false, listingId: 'listing-2', prices: new Map([[LISTING_ID, PRICE]]) }))
      .toEqual({ kind: 'ready', price: undefined });
  });
});
