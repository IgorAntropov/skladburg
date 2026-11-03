import type { Listing } from '@skladburg/contracts/catalog/v1/catalog';

import { create } from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  ListingSchema,
  PriceUnitSchema,
  WarehouseAvailabilitySchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { isListingDataEqual } from './isListingDataEqual';

const createStock = (warehouseId: string, status: AvailabilityStatus, quantity: bigint): Listing['availability'][number] => (
  create(WarehouseAvailabilitySchema, { quantity, status, warehouseId })
);

const createListing = (change?: (listing: Listing) => void): Listing => {
  const listing = create(ListingSchema, {
    availability: [createStock('w1', AvailabilityStatus.IN_STOCK, 900000n)],
    minOrderQuantity: 480000n,
    orderStep: 1000n,
    priceUnit: { baseQuantity: 1000n, name: 'кг' },
    version: 3n,
  });

  change?.(listing);

  return listing;
};

describe('comparison of the data of the listing', () => {
  it('ignores the version and the publication', () => {
    const published = createListing((listing) => {
      listing.isPublished = true;
      listing.version = 5n;
    });

    expect(isListingDataEqual(createListing(), published)).toBe(true);
  });

  it('sees a changed unit, quantity or step', () => {
    const otherUnit = createListing((listing) => {
      listing.priceUnit = create(PriceUnitSchema, { baseQuantity: 1n, name: 'г' });
    });
    const otherMinimum = createListing((listing) => {
      listing.minOrderQuantity = 1000n;
    });
    const otherStep = createListing((listing) => {
      listing.orderStep = 500n;
    });

    expect(isListingDataEqual(createListing(), otherUnit)).toBe(false);
    expect(isListingDataEqual(createListing(), otherMinimum)).toBe(false);
    expect(isListingDataEqual(createListing(), otherStep)).toBe(false);
  });

  it('sees a changed availability', () => {
    const changed = createListing((listing) => {
      listing.availability = [createStock('w1', AvailabilityStatus.LOW, 100n)];
    });
    const longer = createListing((listing) => {
      listing.availability = [
        createStock('w1', AvailabilityStatus.IN_STOCK, 900000n),
        createStock('w2', AvailabilityStatus.ON_ORDER, 0n),
      ];
    });

    expect(isListingDataEqual(createListing(), changed)).toBe(false);
    expect(isListingDataEqual(createListing(), longer)).toBe(false);
  });
});
