import type {
  PriceTier,
  WarehouseAvailability,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { Money } from '@skladburg/contracts/common/v1/money';

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import * as catalog from './seedCatalog';

interface SeedOfferValue {
  availability: WarehouseAvailability[];
  isDiscountForbidden: boolean;
  minPrice: Money | undefined;
  name: string;
  tiers: PriceTier[];
}

const readOffers = (source: typeof catalog): SeedOfferValue[] => {
  const listings = source.createSeedListings();
  const prices = source.createSeedListingPrices();

  return source.createSeedProducts().map((product) => {
    const listing = listings.find(candidate => candidate.productId === product.id);
    const price = prices.find(candidate => candidate.listingId === listing?.id);

    if (listing === undefined || price === undefined) {
      throw new Error('Expected the product listing and its price');
    }

    return {
      availability: listing.availability,
      isDiscountForbidden: product.isDiscountForbidden,
      minPrice: product.minPrice,
      name: product.name,
      tiers: price.tiers,
    };
  }).sort((current, prev) => current.name.localeCompare(prev.name));
};

afterEach(() => {
  vi.doUnmock('./seedCatalogFresh');
  vi.doUnmock('./seedCatalogConstruction');
  vi.resetModules();
});

describe('seed catalog row order', () => {
  it('keeps availability, discount rules and price tiers with the product when rows move', async () => {
    const expected = readOffers(catalog);
    vi.resetModules();
    vi.doMock('./seedCatalogFresh', async (importOriginal) => {
      const source = await importOriginal<typeof import('./seedCatalogFresh')>();

      return {
        ...source,
        FRESH_DAIRY_ROWS: [...source.FRESH_DAIRY_ROWS].reverse(),
        FRESH_FRUIT_ROWS: [...source.FRESH_FRUIT_ROWS].reverse(),
        FRESH_GARDEN_ROWS: [...source.FRESH_GARDEN_ROWS].reverse(),
        FRESH_POULTRY_ROWS: [...source.FRESH_POULTRY_ROWS].reverse(),
      };
    });
    vi.doMock('./seedCatalogConstruction', async (importOriginal) => {
      const source = await importOriginal<typeof import('./seedCatalogConstruction')>();

      return {
        ...source,
        CONSTRUCTION_CEMENT_ROWS: [...source.CONSTRUCTION_CEMENT_ROWS].reverse(),
        CONSTRUCTION_METAL_ROWS: [...source.CONSTRUCTION_METAL_ROWS].reverse(),
        CONSTRUCTION_TIMBER_ROWS: [...source.CONSTRUCTION_TIMBER_ROWS].reverse(),
      };
    });
    const reordered = await import('./seedCatalog');

    expect(readOffers(reordered)).toEqual(expected);
  });
});
