import { create } from '@bufbuild/protobuf';
import {
  ListingSchema,
  OwnListingSchema,
  ProductSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { toOwnListingPairs } from './toOwnListingPairs';

describe('toOwnListingPairs', () => {
  it('keeps the order of the listings that have both the position and the product', () => {
    const pairs = toOwnListingPairs([
      create(OwnListingSchema, {
        listing: create(ListingSchema, { id: 'first' }),
        product: create(ProductSchema, { name: 'Яблоки' }),
      }),
      create(OwnListingSchema, {
        listing: create(ListingSchema, { id: 'second' }),
        product: create(ProductSchema, { name: 'Груши' }),
      }),
    ]);

    expect(pairs.map(pair => pair.listing.id)).toEqual(['first', 'second']);
  });

  it('drops a listing that came without its product or without the position', () => {
    const pairs = toOwnListingPairs([
      create(OwnListingSchema, { listing: create(ListingSchema, { id: 'no-product' }) }),
      create(OwnListingSchema, { product: create(ProductSchema, { name: 'Груши' }) }),
      create(OwnListingSchema, {
        listing: create(ListingSchema, { id: 'whole' }),
        product: create(ProductSchema, { name: 'Яблоки' }),
      }),
    ]);

    expect(pairs.map(pair => pair.listing.id)).toEqual(['whole']);
  });
});
