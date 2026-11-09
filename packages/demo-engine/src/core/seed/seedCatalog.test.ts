import { create } from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  BaseUnit,
  type Listing,
  type ListingPrice,
  MarkingMode,
  type Product,
  SaveListingPriceRequestSchema,
  SaveListingRequestSchema,
  SavePriceListRequestSchema,
  SaveProductRequestSchema,
  SaveSalesTermsRequestSchema,
  VatRate,
} from '@skladburg/contracts/catalog/v1/catalog';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { isGtinValid } from '@skladburg/contracts/forms';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import { getContractRegistry } from '@skladburg/contracts/registry';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../errors/index';
import {
  collectListingPriceViolations,
  collectListingViolations,
  collectProductViolations,
  collectPublicationViolations,
  collectSalesTermsViolations,
  collectTierAmounts,
  MAX_CATALOG_AMOUNT_MINOR,
  MAX_CATALOG_QUANTITY,
} from '../modules/catalog/catalogRules';
import {
  createSupplierViewerCall,
  CUSTOMER_CALL,
} from '../modules/catalog/showcase/testing/showcaseFixtures';
import { listFullShowcase } from '../modules/catalog/testing/catalogFixtures';
import {
  callAs,
  createModuleHarness,
} from '../modules/testing/moduleHarness';
import { createSeededRandom } from '../ports/index';
import { createRequestValidator } from '../validation/index';
import {
  createSeedListingPrices,
  createSeedListings,
  createSeedPriceLists,
  createSeedProducts,
  createSeedSalesTerms,
} from './seedCatalog';
import {
  SeedCityId,
  SeedOrganizationId,
  SeedSphereId,
  SeedUserId,
  SeedWarehouseId,
} from './seedIds';
import {
  createSeedRecords,
  createSeedSnapshot,
} from './seedSnapshot';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SKU_PATTERN = /^S[1-7]-\d{3}$/;
const GTIN_RANGE_MIN = 200;
const GTIN_RANGE_MAX = 299;
const GTIN_PREFIX_LENGTH = 3;
const GTIN_LENGTH = 13;
const REQUEST_KEY = '0b000000-0000-4000-8000-000000000001';
const VOLUME_DIVISOR = 1000;
const CATALOG_TABLES = new Set(['listingPrices', 'listings', 'priceLists', 'products', 'salesTerms']);

const SUPPLIER_IDS = [
  SeedOrganizationId.SUPPLIER_1,
  SeedOrganizationId.SUPPLIER_2,
  SeedOrganizationId.SUPPLIER_3,
  SeedOrganizationId.SUPPLIER_4,
  SeedOrganizationId.SUPPLIER_5,
  SeedOrganizationId.SUPPLIER_6,
  SeedOrganizationId.SUPPLIER_7,
];

const EXPECTED_SALES_TERMS = [
  { delivery: [1200n, 150_000n], isAutoConfirmEnabled: false, organizationId: SeedOrganizationId.SUPPLIER_1, preparation: 2 },
  { delivery: [1400n, 180_000n], isAutoConfirmEnabled: false, organizationId: SeedOrganizationId.SUPPLIER_2, preparation: 1 },
  { delivery: [1600n, 300_000n], isAutoConfirmEnabled: false, organizationId: SeedOrganizationId.SUPPLIER_3, preparation: 3 },
  { delivery: undefined, isAutoConfirmEnabled: true, organizationId: SeedOrganizationId.SUPPLIER_4, preparation: 2 },
  { delivery: undefined, isAutoConfirmEnabled: false, organizationId: SeedOrganizationId.SUPPLIER_5, preparation: 1 },
  { delivery: [1400n, 150_000n], isAutoConfirmEnabled: true, organizationId: SeedOrganizationId.SUPPLIER_6, preparation: 1 },
  { delivery: [1600n, 250_000n], isAutoConfirmEnabled: true, organizationId: SeedOrganizationId.SUPPLIER_7, preparation: 2 },
] as const;

const products = createSeedProducts();
const listings = createSeedListings();
const listingPrices = createSeedListingPrices();
const priceLists = createSeedPriceLists();
const salesTerms = createSeedSalesTerms();
const records = createSeedRecords();
const validator = createRequestValidator(createDomainErrors(createSeededRandom(1)), getContractRegistry());

const productsOf = (organizationId: string): Product[] => products.filter(product => product.tenantId === organizationId);

const listingOfProduct = (productId: string): Listing => {
  const listing = listings.find(candidate => candidate.productId === productId);

  if (listing === undefined) {
    throw new Error('A product of the seed has no listing');
  }

  return listing;
};

const priceOfListing = (listingId: string): ListingPrice => {
  const price = listingPrices.find(candidate => candidate.listingId === listingId);

  if (price === undefined) {
    throw new Error('A listing of the seed has no price');
  }

  return price;
};

const findProductByName = (name: string): Product => {
  const product = products.find(candidate => candidate.name === name);

  if (product === undefined) {
    throw new Error('The seed has no product with this name');
  }

  return product;
};

const hasWholeUnits = (value: bigint, unit: bigint): boolean => value % unit === 0n;

describe('seed catalog size', () => {
  it('holds thirty positions for each of six suppliers and five for the unverified one', () => {
    for (const organizationId of SUPPLIER_IDS) {
      const expected = organizationId === SeedOrganizationId.SUPPLIER_5 ? 5 : 30;

      expect(productsOf(organizationId), organizationId).toHaveLength(expected);
      expect(listings.filter(listing => listing.tenantId === organizationId), organizationId).toHaveLength(expected);
      expect(listingPrices.filter(price => price.tenantId === organizationId), organizationId).toHaveLength(expected);
    }

    expect(products).toHaveLength(185);
    expect(listings).toHaveLength(185);
    expect(listingPrices).toHaveLength(185);
  });

  it('gives every product one listing, one price and one published flag', () => {
    for (const product of products) {
      const matching = listings.filter(listing => listing.productId === product.id);

      expect(matching, product.name).toHaveLength(1);
      expect(matching[0]?.tenantId, product.name).toBe(product.tenantId);
      expect(matching[0]?.isPublished, product.name).toBe(true);
      expect(listingPrices.filter(price => price.listingId === matching[0]?.id), product.name).toHaveLength(1);
    }
  });

  it('puts the catalog into the seed records and the snapshot', () => {
    const snapshot = createSeedSnapshot();

    expect(records.products).toEqual(products);
    expect(records.listings).toEqual(listings);
    expect(records.listingPrices).toEqual(listingPrices);
    expect(records.priceLists).toEqual(priceLists);
    expect(records.salesTerms).toEqual(salesTerms);
    expect(snapshot.collections.products.size).toBe(185);
    expect(snapshot.collections.listings.size).toBe(185);
    expect(snapshot.collections.listingPrices.size).toBe(185);
    expect(snapshot.collections.priceLists.size).toBe(7);
    expect(snapshot.collections.salesTerms.size).toBe(7);
  });
});

describe('seed catalog identifiers', () => {
  const packagings = products.flatMap(product => product.packagings);
  const catalogIds = [
    ...products.map(product => product.id),
    ...listings.map(listing => listing.id),
    ...packagings.map(packaging => packaging.id),
    ...priceLists.map(priceList => priceList.id),
  ];

  it('gives every identifier the form of a uuid and keeps them unique across the catalog tables', () => {
    for (const id of catalogIds) {
      expect(id).toMatch(UUID_PATTERN);
    }

    expect(new Set(catalogIds).size).toBe(catalogIds.length);
  });

  it('does not meet the identifiers of any other table of the seed', () => {
    const snapshot = createSeedSnapshot();
    const otherIds = new Set(
      Object.entries(snapshot.collections)
        .filter(([name]) => !CATALOG_TABLES.has(name))
        .flatMap(([, collection]) => [...collection.keys()]),
    );

    expect(otherIds.size).toBeGreaterThan(0);

    for (const id of catalogIds) {
      expect(otherIds.has(id), id).toBe(false);
    }
  });

  it('gives each product an article of its supplier and keeps the articles unique inside the organization', () => {
    for (const organizationId of SUPPLIER_IDS) {
      const skus = productsOf(organizationId).map(product => product.sku);

      expect(new Set(skus).size, organizationId).toBe(skus.length);
    }

    for (const product of products) {
      expect(product.sku).toMatch(SKU_PATTERN);
    }
  });

  it('gives every product a unique GTIN of thirteen digits with a correct check digit from the internal range', () => {
    const gtins = products.map(product => product.gtin);

    expect(new Set(gtins).size).toBe(gtins.length);

    for (const gtin of gtins) {
      expect(gtin).toHaveLength(GTIN_LENGTH);
      expect(isGtinValid(gtin), gtin).toBe(true);
      expect(Number(gtin.slice(0, GTIN_PREFIX_LENGTH)), gtin).toBeGreaterThanOrEqual(GTIN_RANGE_MIN);
      expect(Number(gtin.slice(0, GTIN_PREFIX_LENGTH)), gtin).toBeLessThanOrEqual(GTIN_RANGE_MAX);
      expect(gtin.startsWith('200'), gtin).toBe(false);
    }
  });

  it('keeps the product names of one supplier different', () => {
    for (const organizationId of SUPPLIER_IDS) {
      const names = productsOf(organizationId).map(product => product.name);

      expect(new Set(names).size, organizationId).toBe(names.length);
    }
  });
});

describe('seed catalog against the contract rules', () => {
  it('lets every product pass the rules of the save command', () => {
    for (const product of products) {
      const request = create(SaveProductRequestSchema, {
        baseUnit: product.baseUnit,
        gtin: product.gtin,
        idempotencyKey: REQUEST_KEY,
        isDiscountForbidden: product.isDiscountForbidden,
        markingMode: product.markingMode,
        minPrice: product.minPrice,
        name: product.name,
        packagings: product.packagings,
        productId: product.id,
        shelfLifeDays: product.shelfLifeDays,
        sku: product.sku,
        storageTemperature: product.storageTemperature,
        vatRate: product.vatRate,
      });

      expect(validator.collect(SaveProductRequestSchema, request), product.name).toEqual([]);
    }
  });

  it('lets every listing pass the rules of the save command', () => {
    for (const listing of listings) {
      const request = create(SaveListingRequestSchema, {
        availability: listing.availability,
        idempotencyKey: REQUEST_KEY,
        listingId: listing.id,
        minOrderQuantity: listing.minOrderQuantity,
        orderStep: listing.orderStep,
        priceUnit: listing.priceUnit,
        productId: listing.productId,
        sphereIds: listing.sphereIds,
      });

      expect(validator.collect(SaveListingRequestSchema, request), listing.id).toEqual([]);
    }
  });

  it('lets every price pass the rules of the save command', () => {
    for (const price of listingPrices) {
      const request = create(SaveListingPriceRequestSchema, {
        idempotencyKey: REQUEST_KEY,
        listingId: price.listingId,
        tiers: price.tiers,
      });

      expect(validator.collect(SaveListingPriceRequestSchema, request), price.listingId).toEqual([]);
    }
  });

  it('lets every price list and every record of sales terms pass the rules of the save commands', () => {
    for (const priceList of priceLists) {
      const request = create(SavePriceListRequestSchema, { idempotencyKey: REQUEST_KEY, validUntil: priceList.validUntil });

      expect(validator.collect(SavePriceListRequestSchema, request), priceList.id).toEqual([]);
    }

    for (const terms of salesTerms) {
      const request = create(SaveSalesTermsRequestSchema, {
        idempotencyKey: REQUEST_KEY,
        isAutoConfirmEnabled: terms.isAutoConfirmEnabled,
        ownDelivery: terms.ownDelivery,
        preparationWorkingDays: terms.preparationWorkingDays,
      });

      expect(validator.collect(SaveSalesTermsRequestSchema, request), terms.organizationId).toEqual([]);
    }
  });

  it('passes the domain rules of the products', () => {
    for (const product of products) {
      const others = productsOf(product.tenantId).filter(candidate => candidate.id !== product.id);
      const price = priceOfListing(listingOfProduct(product.id).id);

      expect(collectProductViolations({
        baseUnit: product.baseUnit,
        baseUnitLock: undefined,
        gtin: product.gtin,
        minPrice: product.minPrice,
        packagings: product.packagings,
        sku: product.sku,
        storageTemperature: product.storageTemperature,
        takenGtins: new Set(others.map(candidate => candidate.gtin)),
        takenSkus: new Set(others.map(candidate => candidate.sku)),
        tierAmounts: collectTierAmounts(price.tiers),
      }), product.name).toEqual([]);
    }
  });

  it('passes the domain rules of the listings, the publication and the prices', () => {
    const sphereIds = new Set(records.spheres.map(sphere => sphere.id));

    for (const listing of listings) {
      const product = products.find(candidate => candidate.id === listing.productId);
      const price = priceOfListing(listing.id);
      const ownWarehouseIds = new Set(
        records.warehouses.filter(warehouse => warehouse.tenantId === listing.tenantId).map(warehouse => warehouse.id),
      );
      const baseQuantity = listing.priceUnit?.baseQuantity ?? 0n;

      expect(collectListingViolations({
        availability: listing.availability,
        baseQuantity,
        existingFirstTierMinQuantity: price.tiers[0]?.minQuantity,
        isProductTaken: listings.some(candidate => candidate.productId === listing.productId && candidate.id !== listing.id),
        isPublished: listing.isPublished,
        knownSphereIds: sphereIds,
        minOrderQuantity: listing.minOrderQuantity,
        orderStep: listing.orderStep,
        ownWarehouseIds,
        priceLock: { baseQuantity, productId: listing.productId },
        productId: listing.productId,
        sphereIds: listing.sphereIds,
      }), listing.id).toEqual([]);
      expect(collectPublicationViolations({ availabilityCount: listing.availability.length, hasPrice: true }), listing.id).toEqual([]);
      expect(collectListingPriceViolations({
        minOrderQuantity: listing.minOrderQuantity,
        productMinPrice: product?.minPrice,
        tiers: price.tiers,
      }), listing.id).toEqual([]);
    }
  });

  it('passes the domain rules of the sales terms', () => {
    for (const terms of salesTerms) {
      expect(collectSalesTermsViolations(terms.ownDelivery), terms.organizationId).toEqual([]);
    }
  });
});

describe('seed catalog quantities', () => {
  it('keeps the quantities and the steps whole and inside the limit', () => {
    for (const listing of listings) {
      expect(listing.minOrderQuantity, listing.id).toBeGreaterThan(0n);
      expect(listing.minOrderQuantity, listing.id).toBeLessThanOrEqual(MAX_CATALOG_QUANTITY);
      expect(hasWholeUnits(listing.minOrderQuantity, listing.orderStep), listing.id).toBe(true);

      for (const entry of listing.availability) {
        expect(entry.quantity, listing.id).toBeLessThanOrEqual(MAX_CATALOG_QUANTITY);
      }
    }

    for (const price of listingPrices) {
      for (const tier of price.tiers) {
        expect(tier.minQuantity, price.listingId).toBeLessThanOrEqual(MAX_CATALOG_QUANTITY);
        expect(tier.price?.amountMinor, price.listingId).toBeLessThanOrEqual(MAX_CATALOG_AMOUNT_MINOR);
      }
    }
  });

  it('prices by a unit that suits the base unit', () => {
    for (const listing of listings) {
      const product = products.find(candidate => candidate.id === listing.productId);
      const unitBaseQuantity = listing.priceUnit?.baseQuantity;

      if (product?.baseUnit === BaseUnit.PIECE) {
        expect(unitBaseQuantity, listing.id).toBe(1n);
      }
      else {
        expect([1000n, 1_000_000n], listing.id).toContain(unitBaseQuantity);
      }
    }
  });

  it('gives each product one or two packagings with a size that matches the volume', () => {
    for (const product of products) {
      expect(product.packagings.length, product.name).toBeGreaterThanOrEqual(1);
      expect(product.packagings.length, product.name).toBeLessThanOrEqual(2);

      for (const packaging of product.packagings) {
        const boxVolume = Math.round(
          packaging.lengthMillimeters * packaging.widthMillimeters * packaging.heightMillimeters / VOLUME_DIVISOR,
        );

        expect(packaging.volumeCubicCentimeters, packaging.name).toBe(BigInt(boxVolume));
        expect(packaging.grossWeightGrams, packaging.name).toBeGreaterThan(0n);

        if (product.baseUnit === BaseUnit.GRAM) {
          expect(packaging.grossWeightGrams, packaging.name).toBeGreaterThanOrEqual(packaging.baseQuantity);
        }
      }
    }
  });

  it('gives two or three tiers whose thresholds grow and whose prices fall, the first one at the minimum order', () => {
    for (const listing of listings) {
      const { tiers } = priceOfListing(listing.id);

      expect(tiers.length, listing.id).toBeGreaterThanOrEqual(2);
      expect(tiers.length, listing.id).toBeLessThanOrEqual(3);
      expect(tiers[0]?.minQuantity, listing.id).toBe(listing.minOrderQuantity);

      tiers.slice(1).forEach((tier, index) => {
        const previous = tiers[index];

        expect(tier.minQuantity, listing.id).toBeGreaterThan(previous?.minQuantity ?? 0n);
        expect(tier.price?.amountMinor, listing.id).toBeLessThan(previous?.price?.amountMinor ?? 0n);
      });
    }
  });

  it('keeps the minimum price at or below the lowest tier for about a third of the products', () => {
    const withMinimum = products.filter(product => product.minPrice !== undefined);
    const equalToLowest = withMinimum.filter((product) => {
      const lowest = priceOfListing(listingOfProduct(product.id).id).tiers.at(-1)?.price?.amountMinor;

      return product.minPrice?.amountMinor === lowest;
    });

    expect(withMinimum.length).toBeGreaterThanOrEqual(products.length * 0.25);
    expect(withMinimum.length).toBeLessThanOrEqual(products.length * 0.4);
    expect(equalToLowest.length).toBeGreaterThan(0);
    expect(equalToLowest.length).toBeLessThan(withMinimum.length);
  });

  it('forbids discounts for a part of the products only', () => {
    const forbidden = products.filter(product => product.isDiscountForbidden);

    expect(forbidden.length).toBeGreaterThan(0);
    expect(forbidden.length).toBeLessThan(products.length / 2);
  });

  it('mixes the availability: mostly in stock, some low and some on order without quantity', () => {
    const entries = listings.flatMap(listing => listing.availability);
    const inStock = entries.filter(entry => entry.status === AvailabilityStatus.IN_STOCK);
    const low = entries.filter(entry => entry.status === AvailabilityStatus.LOW);
    const onOrder = entries.filter(entry => entry.status === AvailabilityStatus.ON_ORDER);

    expect(inStock.length).toBeGreaterThan(entries.length / 2);
    expect(low.length).toBeGreaterThan(0);
    expect(onOrder.length).toBeGreaterThan(0);
    expect(onOrder.every(entry => entry.quantity === 0n)).toBe(true);
    expect([...inStock, ...low].every(entry => entry.quantity > 0n)).toBe(true);
  });
});

describe('seed catalog data of the verticals', () => {
  it('uses the rate of 10 percent for foods and 22 percent for building materials and no marking', () => {
    const foodSuppliers = new Set<string>([
      SeedOrganizationId.SUPPLIER_1,
      SeedOrganizationId.SUPPLIER_2,
      SeedOrganizationId.SUPPLIER_5,
      SeedOrganizationId.SUPPLIER_6,
    ]);

    for (const product of products) {
      expect(product.vatRate, product.name).toBe(foodSuppliers.has(product.tenantId) ? VatRate.VAT_RATE_10 : VatRate.VAT_RATE_22);
      expect(product.markingMode, product.name).toBe(MarkingMode.NONE);
    }
  });

  it('gives the dairy and the poultry products a temperature range and a shelf life', () => {
    const chilled = [...productsOf(SeedOrganizationId.SUPPLIER_2), ...productsOf(SeedOrganizationId.SUPPLIER_6)];

    for (const product of chilled) {
      expect(product.storageTemperature, product.name).toBeDefined();
      expect(product.storageTemperature?.minCelsius, product.name).toBeLessThanOrEqual(product.storageTemperature?.maxCelsius ?? 0);
      expect(product.shelfLifeDays, product.name).toBeGreaterThan(0);
    }
  });

  it('puts each listing into the sphere of its supplier and lets it lie on the own warehouses only', () => {
    const sphereBySupplier = new Map<string, string>([
      [SeedOrganizationId.SUPPLIER_1, SeedSphereId.FRUIT_AND_VEGETABLES],
      [SeedOrganizationId.SUPPLIER_2, SeedSphereId.DAIRY],
      [SeedOrganizationId.SUPPLIER_3, SeedSphereId.METAL_PRODUCTS],
      [SeedOrganizationId.SUPPLIER_4, SeedSphereId.CEMENT_AND_CONCRETE],
      [SeedOrganizationId.SUPPLIER_5, SeedSphereId.FRUIT_AND_VEGETABLES],
      [SeedOrganizationId.SUPPLIER_6, SeedSphereId.MEAT_AND_POULTRY],
      [SeedOrganizationId.SUPPLIER_7, SeedSphereId.TIMBER],
    ]);
    const knownSpheres = new Set(records.spheres.map(sphere => sphere.id));

    for (const listing of listings) {
      expect(listing.sphereIds, listing.id).toEqual([sphereBySupplier.get(listing.tenantId)]);
      expect(knownSpheres.has(listing.sphereIds[0] ?? ''), listing.id).toBe(true);
    }
  });

  it('lays every position of the first supplier on both of its warehouses', () => {
    for (const listing of listings.filter(candidate => candidate.tenantId === SeedOrganizationId.SUPPLIER_1)) {
      expect(listing.availability.map(entry => entry.warehouseId), listing.id).toEqual([
        SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
        SeedWarehouseId.SUPPLIER_1_WAREHOUSE_2,
      ]);
    }
  });

  it('lays the positions of the other suppliers on their only warehouse', () => {
    const warehouseBySupplier = new Map<string, string>([
      [SeedOrganizationId.SUPPLIER_2, SeedWarehouseId.SUPPLIER_2_WAREHOUSE_1],
      [SeedOrganizationId.SUPPLIER_3, SeedWarehouseId.SUPPLIER_3_WAREHOUSE_1],
      [SeedOrganizationId.SUPPLIER_4, SeedWarehouseId.SUPPLIER_4_WAREHOUSE_1],
      [SeedOrganizationId.SUPPLIER_5, SeedWarehouseId.SUPPLIER_5_WAREHOUSE_1],
      [SeedOrganizationId.SUPPLIER_6, SeedWarehouseId.SUPPLIER_6_WAREHOUSE_1],
      [SeedOrganizationId.SUPPLIER_7, SeedWarehouseId.SUPPLIER_7_WAREHOUSE_1],
    ]);

    for (const listing of listings.filter(candidate => candidate.tenantId !== SeedOrganizationId.SUPPLIER_1)) {
      expect(listing.availability.map(entry => entry.warehouseId), listing.id).toEqual([warehouseBySupplier.get(listing.tenantId)]);
    }
  });

  it('starts the first supplier with a pallet of golden apples at 89 roubles a kilogram', () => {
    const apples = findProductByName('Яблоки Голден, 1 сорт');
    const listing = listingOfProduct(apples.id);

    expect(apples.tenantId).toBe(SeedOrganizationId.SUPPLIER_1);
    expect(products.find(product => product.tenantId === apples.tenantId)).toBe(apples);
    expect(apples.baseUnit).toBe(BaseUnit.GRAM);
    expect(listing.minOrderQuantity).toBe(480_000n);
    expect(listing.orderStep).toBe(480_000n);
    expect(listing.priceUnit).toMatchObject({ baseQuantity: 1000n, name: 'кг' });
    expect(apples.minPrice).toBeUndefined();
    expect(apples.isDiscountForbidden).toBe(false);
    expect(listing.availability.map(entry => entry.status)).toEqual([AvailabilityStatus.IN_STOCK, AvailabilityStatus.IN_STOCK]);
    expect(priceOfListing(listing.id).tiers.map(tier => [tier.minQuantity, tier.price?.amountMinor])).toEqual([
      [480_000n, 8900n],
      [1_440_000n, 8544n],
      [4_800_000n, 8099n],
    ]);
  });

  it('prices reinforcing bars at the live order of magnitude', () => {
    const bars = findProductByName('Арматура А500С, 12 мм');
    const listing = listingOfProduct(bars.id);

    expect(listing.priceUnit).toMatchObject({ baseQuantity: 1_000_000n, name: 'т' });
    expect(priceOfListing(listing.id).tiers[0]?.price?.amountMinor).toBe(6_200_000n);
  });

  it('keeps one price list a supplier valid to the end of 2027, with a price for every position', () => {
    expect(priceLists.map(priceList => priceList.tenantId)).toEqual(SUPPLIER_IDS);

    for (const priceList of priceLists) {
      expect(priceList.validUntil).toMatchObject({ day: 31, month: 12, year: 2027 });
      expect(priceList.version).toBe(1n);
    }

    for (const price of listingPrices) {
      expect(priceLists.find(priceList => priceList.id === price.priceListId)?.tenantId, price.listingId).toBe(price.tenantId);
    }
  });

  it('keeps the sales terms of the seven suppliers at version one', () => {
    expect(salesTerms).toHaveLength(EXPECTED_SALES_TERMS.length);

    for (const expected of EXPECTED_SALES_TERMS) {
      const terms = salesTerms.find(candidate => candidate.organizationId === expected.organizationId);

      expect(terms?.version, expected.organizationId).toBe(1n);
      expect(terms?.preparationWorkingDays, expected.organizationId).toBe(expected.preparation);
      expect(terms?.isAutoConfirmEnabled, expected.organizationId).toBe(expected.isAutoConfirmEnabled);
      expect(terms?.ownDelivery?.pricePerKm?.amountMinor, expected.organizationId).toBe(expected.delivery?.[0]);
      expect(terms?.ownDelivery?.minimumCharge?.amountMinor, expected.organizationId).toBe(expected.delivery?.[1]);
    }
  });
});

describe('seed catalog on the showcase', () => {
  const customerTwoCall = callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2);
  const customerWarehouseCalls = [
    { call: CUSTOMER_CALL, warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 },
    { call: CUSTOMER_CALL, warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2 },
    { call: CUSTOMER_CALL, warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3 },
    { call: customerTwoCall, warehouseId: SeedWarehouseId.CUSTOMER_2_SITE_1 },
    { call: customerTwoCall, warehouseId: SeedWarehouseId.CUSTOMER_2_SITE_2 },
  ];

  it('shows a customer in Moscow the listings of the verified suppliers and none of the unverified one', async () => {
    const harness = createModuleHarness();

    const response = await listFullShowcase(harness.catalogShowcase, {}, CUSTOMER_CALL);
    const supplierIds = new Set(response.listings.map(listing => listing.supplier?.organizationId));

    expect(response.listings).toHaveLength(180);
    expect(supplierIds.has(SeedOrganizationId.SUPPLIER_5)).toBe(false);
    expect(supplierIds.size).toBe(6);
  });

  it('walks the whole showcase page by page without repeats', async () => {
    const harness = createModuleHarness();
    const seenIds: string[] = [];
    let pageToken = '';

    do {
      const response = await harness.catalogShowcase.listShowcaseListings({ page: { pageSize: 50, pageToken } }, CUSTOMER_CALL);

      seenIds.push(...response.listings.map(listing => listing.id));
      pageToken = response.page?.nextPageToken ?? '';
    } while (pageToken !== '');

    expect(seenIds).toHaveLength(180);
    expect(new Set(seenIds).size).toBe(180);
  });

  it('shows the same listings to the second customer', async () => {
    const harness = createModuleHarness();

    const first = await listFullShowcase(harness.catalogShowcase, {}, CUSTOMER_CALL);
    const second = await listFullShowcase(harness.catalogShowcase, {}, customerTwoCall);

    expect(second.listings.map(listing => listing.id)).toEqual(first.listings.map(listing => listing.id));
  });

  it('does not show a supplier its own listings', async () => {
    const harness = createModuleHarness();
    const ownerCall = await createSupplierViewerCall(harness, SeedOrganizationId.SUPPLIER_1, [
      { kind: ProfileKind.SUPPLIER, verificationLevel: 2 },
      { kind: ProfileKind.CUSTOMER, verificationLevel: 2 },
    ]);

    const response = await listFullShowcase(harness.catalogShowcase, {}, ownerCall);

    expect(response.listings).toHaveLength(150);
    expect(response.listings.some(listing => listing.supplier?.organizationId === SeedOrganizationId.SUPPLIER_1)).toBe(false);
  });

  it('quotes a pallet of golden apples to Moscow at the price of the example', async () => {
    const harness = createModuleHarness();
    const listing = listingOfProduct(findProductByName('Яблоки Голден, 1 сорт').id);

    const response = await harness.catalogShowcase.getShowcaseListing(
      { listingId: listing.id, toWarehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 },
      CUSTOMER_CALL,
    );
    const [quote] = response.listing?.quotes ?? [];

    expect(response.listing?.quotes).toHaveLength(1);
    expect(quote?.quantity).toBe(480_000n);
    expect(quote?.goodsTotal?.amountMinor).toBe(4_272_000n);
    expect(quote?.deliveryPrice?.amountMinor).toBe(1_524_000n);
    expect(quote?.total?.amountMinor).toBe(5_796_000n);
    expect(quote?.distanceKm).toBe(1270);
    expect(quote?.etaDate).toMatchObject({ day: 15, month: 10, year: 2026 });
    expect(quote?.shipFromCityId).toBe(SeedCityId.KRASNODAR);
    expect(quote?.method).toBe(DeliveryMethod.SUPPLIER);
    expect(response.listing?.cityAvailability).toHaveLength(1);
    expect(response.listing?.cityAvailability[0]).toMatchObject({
      cityId: SeedCityId.KRASNODAR,
      quantity: 17_280_000n,
      status: AvailabilityStatus.IN_STOCK,
    });
  });

  it('charges the minimum for the supplier of poultry in the city of the customer', async () => {
    const harness = createModuleHarness();
    const listing = listingOfProduct(findProductByName('Утка тушка охлаждённая, 1 сорт').id);

    const response = await harness.catalogShowcase.getShowcaseListing(
      { listingId: listing.id, toWarehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 },
      CUSTOMER_CALL,
    );
    const [quote] = response.listing?.quotes ?? [];

    expect(quote?.distanceKm).toBe(22);
    expect(quote?.deliveryPrice?.amountMinor).toBe(150_000n);
    expect(quote?.method).toBe(DeliveryMethod.SUPPLIER);
  });

  it('leaves the delivery of cement to the customer on the way to every warehouse', async () => {
    const harness = createModuleHarness();
    const listing = listingOfProduct(findProductByName('Цемент М500, мешок 50 кг').id);

    for (const { call, warehouseId } of customerWarehouseCalls) {
      const response = await harness.catalogShowcase.getShowcaseListing({ listingId: listing.id, toWarehouseId: warehouseId }, call);
      const [quote] = response.listing?.quotes ?? [];

      expect(response.listing?.quotes, warehouseId).toHaveLength(1);
      expect(quote?.method, warehouseId).toBe(DeliveryMethod.CUSTOMER);
      expect(quote?.deliveryPrice?.amountMinor, warehouseId).toBe(0n);
    }
  });
});
