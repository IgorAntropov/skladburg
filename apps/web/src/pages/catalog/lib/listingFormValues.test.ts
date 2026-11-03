import { create } from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  ListingPriceSchema,
  ListingSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getInitialTierCount,
  NOT_SHIPPED_STATUS_VALUE,
  TIER_CAPACITY,
  toListingFormValues,
  toPriceFormValues,
} from './listingFormValues';

const MOSCOW = 'a0000001-0000-4000-8000-000000000001';
const KAZAN = 'a0000001-0000-4000-8000-000000000002';
const TVER = 'a0000001-0000-4000-8000-000000000003';

describe('values of the form of the listing', () => {
  const listing = create(ListingSchema, {
    availability: [
      { quantity: 900000n, status: AvailabilityStatus.IN_STOCK, warehouseId: TVER },
      { quantity: 0n, status: AvailabilityStatus.ON_ORDER, warehouseId: MOSCOW },
    ],
    minOrderQuantity: 480000n,
    orderStep: 1000n,
    priceUnit: { baseQuantity: 1000n, name: 'кг' },
  });

  it('gives a row to every warehouse of the company in their order, not shipped ones included', () => {
    const values = toListingFormValues(listing, [MOSCOW, KAZAN, TVER]);

    expect(values.availability).toEqual([
      { quantity: '', status: String(AvailabilityStatus.ON_ORDER), warehouseId: MOSCOW },
      { quantity: '', status: NOT_SHIPPED_STATUS_VALUE, warehouseId: KAZAN },
      { quantity: '900000', status: String(AvailabilityStatus.IN_STOCK), warehouseId: TVER },
    ]);
  });

  it('keeps the quantities and the unit in the base units as texts', () => {
    const values = toListingFormValues(listing, []);

    expect(values).toMatchObject({
      minOrderQuantity: '480000',
      orderStep: '1000',
      priceUnit: { baseQuantity: '1000', name: 'кг' },
    });
  });
});

describe('values of the form of the price', () => {
  it('fills the rows of the tiers and leaves the rest empty up to the capacity', () => {
    const price = create(ListingPriceSchema, {
      tiers: [
        { minQuantity: 1000n, price: { amountMinor: 8950n, currencyCode: 'RUB' } },
        { minQuantity: 10000n, price: { amountMinor: 8000n, currencyCode: 'RUB' } },
      ],
    });

    const { tiers } = toPriceFormValues(price);

    expect(tiers).toHaveLength(TIER_CAPACITY);
    expect(tiers[1]).toEqual({ minQuantity: '10000', price: { amountMinor: '8000', currencyCode: 'RUB' } });
    expect(tiers[2]).toEqual({ minQuantity: '', price: { amountMinor: '', currencyCode: 'RUB' } });
    expect(getInitialTierCount(price)).toBe(2);
  });

  it('shows one empty row when the listing has no price yet', () => {
    expect(toPriceFormValues(undefined).tiers).toHaveLength(TIER_CAPACITY);
    expect(getInitialTierCount(undefined)).toBe(1);
  });
});
