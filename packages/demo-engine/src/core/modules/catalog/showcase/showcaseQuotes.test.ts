import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  BaseUnit,
  PriceTierSchema,
  PriceUnitSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  DeliveryMethod,
  DeliveryQuoteSchema,
} from '@skladburg/contracts/catalog/v1/showcase';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedCityId,
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../../seed/index';
import { createModuleHarness } from '../../testing/moduleHarness';
import {
  MAX_CATALOG_AMOUNT_MINOR,
  MAX_CATALOG_QUANTITY,
} from '../catalogRules';
import {
  buildAvailability,
  buildRub,
  captureFailure,
  listFullShowcase,
  SUPPLIER_1_CALL,
} from '../testing/catalogFixtures';
import {
  addSupplierWarehouse,
  createShowcaseClientAt,
  createShowcaseListing,
  CUSTOMER_CALL,
  CUSTOMER_WAREHOUSE_ID,
  NOVOSIBIRSK_LOCATION,
  savePriceListEnd,
  saveSalesTerms,
  SUPPLIER_6_CALL,
  UNKNOWN_ID,
  VORONEZH_LOCATION,
} from './testing/showcaseFixtures';

const OWN_DELIVERY = { minimumChargeMinor: 150_000n, pricePerKmMinor: 1200n };
const PALLET_LISTING = {
  availability: [buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1, 2_000_000n)],
  minOrderQuantity: 480_000n,
  orderStep: 1000n,
  priceUnit: create(PriceUnitSchema, { baseQuantity: 1000n, name: 'кг' }),
};
const PALLET_PRICE = { tiers: [create(PriceTierSchema, { minQuantity: 480_000n, price: buildRub(8900n) })] };
const PALLET_PRODUCT = { baseUnit: BaseUnit.GRAM, name: 'Яблоки Голден, паллета' };

describe('availability of a listing by city', () => {
  it('sums the warehouses of one city into a single record and does not name the warehouses', async () => {
    const harness = createModuleHarness();
    const { read } = harness.state;
    const { listing } = await createShowcaseListing(harness, {
      listing: {
        availability: [
          buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1, 30n, AvailabilityStatus.LOW),
          buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_2, 70n, AvailabilityStatus.IN_STOCK),
        ],
      },
    });

    const response = await harness.catalogShowcase.getShowcaseListing({ listingId: listing.id }, CUSTOMER_CALL);

    expect(read.get('warehouses', SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1)?.cityId)
      .toBe(read.get('warehouses', SeedWarehouseId.SUPPLIER_1_WAREHOUSE_2)?.cityId);
    expect(response.listing?.cityAvailability).toHaveLength(1);
    expect(response.listing?.cityAvailability[0]).toMatchObject({
      cityId: SeedCityId.KRASNODAR,
      quantity: 100n,
      status: AvailabilityStatus.IN_STOCK,
    });
  });
});

describe('the price to the warehouse of the customer', () => {
  it('prices the supplier delivery, the sum and the arrival date of a pallet from Krasnodar to Moscow', async () => {
    const harness = createModuleHarness();

    await saveSalesTerms(harness, SUPPLIER_1_CALL, { ownDelivery: OWN_DELIVERY, preparationWorkingDays: 2 });

    const { listing } = await createShowcaseListing(harness, {
      listing: PALLET_LISTING,
      price: PALLET_PRICE,
      product: PALLET_PRODUCT,
    });

    const list = await listFullShowcase(
      harness.catalogShowcase,
      { query: 'паллета', toWarehouseId: CUSTOMER_WAREHOUSE_ID },
      CUSTOMER_CALL,
    );
    const one = await harness.catalogShowcase.getShowcaseListing(
      { listingId: listing.id, toWarehouseId: CUSTOMER_WAREHOUSE_ID },
      CUSTOMER_CALL,
    );
    const [quote] = one.listing?.quotes ?? [];

    expect(list.listings.find(item => item.id === listing.id)?.quotes).toEqual(one.listing?.quotes);
    expect(quote).toMatchObject({
      distanceKm: 1270,
      method: DeliveryMethod.SUPPLIER,
      quantity: 480_000n,
      shipFromCityId: SeedCityId.KRASNODAR,
    });
    expect(quote?.unitPrice?.amountMinor).toBe(8900n);
    expect(quote?.goodsTotal?.amountMinor).toBe(4_272_000n);
    expect(quote?.deliveryPrice?.amountMinor).toBe(1_524_000n);
    expect(quote?.total?.amountMinor).toBe(5_796_000n);
    expect(quote?.total?.currencyCode).toBe('RUB');
    expect(quote?.etaDate).toMatchObject({ day: 15, month: 10, year: 2026 });
  });

  it('leaves the delivery to the customer when the supplier has no own delivery', async () => {
    const harness = createModuleHarness();

    await saveSalesTerms(harness, SUPPLIER_1_CALL, { preparationWorkingDays: 1 });

    const { listing } = await createShowcaseListing(harness);
    const response = await harness.catalogShowcase.getShowcaseListing(
      { listingId: listing.id, toWarehouseId: CUSTOMER_WAREHOUSE_ID },
      CUSTOMER_CALL,
    );
    const [quote] = response.listing?.quotes ?? [];

    expect(quote?.method).toBe(DeliveryMethod.CUSTOMER);
    expect(quote?.deliveryPrice?.amountMinor).toBe(0n);
    expect(quote?.total?.amountMinor).toBe(quote?.goodsTotal?.amountMinor);
  });

  it('charges the minimum for a supplier in the city of the customer', async () => {
    const harness = createModuleHarness();

    await saveSalesTerms(harness, SUPPLIER_6_CALL, {
      ownDelivery: { minimumChargeMinor: 150_000n, pricePerKmMinor: 1400n },
      preparationWorkingDays: 1,
    });

    const { listing } = await createShowcaseListing(harness, {
      call: SUPPLIER_6_CALL,
      listing: { availability: [buildAvailability(SeedWarehouseId.SUPPLIER_6_WAREHOUSE_1)] },
    });
    const response = await harness.catalogShowcase.getShowcaseListing(
      { listingId: listing.id, toWarehouseId: CUSTOMER_WAREHOUSE_ID },
      CUSTOMER_CALL,
    );
    const [quote] = response.listing?.quotes ?? [];

    expect(quote?.distanceKm).toBe(0);
    expect(quote?.deliveryPrice?.amountMinor).toBe(150_000n);
  });

  it('starts the quotes with the cheapest city and lists every city with availability', async () => {
    const harness = createModuleHarness();
    const voronezhWarehouseId = await addSupplierWarehouse(harness, SeedOrganizationId.SUPPLIER_1, VORONEZH_LOCATION);

    await saveSalesTerms(harness, SUPPLIER_1_CALL, { ownDelivery: OWN_DELIVERY, preparationWorkingDays: 1 });

    const { listing } = await createShowcaseListing(harness, {
      listing: {
        availability: [
          buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1),
          buildAvailability(voronezhWarehouseId),
        ],
      },
    });
    const response = await harness.catalogShowcase.getShowcaseListing(
      { listingId: listing.id, toWarehouseId: CUSTOMER_WAREHOUSE_ID },
      CUSTOMER_CALL,
    );
    const quotes = response.listing?.quotes ?? [];

    expect(response.listing?.cityAvailability.map(city => city.cityId)).toEqual([SeedCityId.KRASNODAR, SeedCityId.VORONEZH]);
    expect(quotes.map(quote => quote.shipFromCityId)).toEqual([SeedCityId.VORONEZH, SeedCityId.KRASNODAR]);
    expect(quotes[0]?.total?.amountMinor).toBeLessThan(quotes[1]?.total?.amountMinor ?? 0n);
  });

  it('breaks a tie of totals by the city identifier', async () => {
    const harness = createModuleHarness();
    const voronezhWarehouseId = await addSupplierWarehouse(harness, SeedOrganizationId.SUPPLIER_1, VORONEZH_LOCATION);

    await saveSalesTerms(harness, SUPPLIER_1_CALL, { preparationWorkingDays: 1 });

    const { listing } = await createShowcaseListing(harness, {
      listing: {
        availability: [
          buildAvailability(voronezhWarehouseId),
          buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1),
        ],
      },
    });
    const response = await harness.catalogShowcase.getShowcaseListing(
      { listingId: listing.id, toWarehouseId: CUSTOMER_WAREHOUSE_ID },
      CUSTOMER_CALL,
    );

    expect(response.listing?.quotes.map(quote => quote.shipFromCityId)).toEqual([SeedCityId.KRASNODAR, SeedCityId.VORONEZH]);
  });

  it('puts the minimum quantity into the quotes of the list', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness);

    const response = await listFullShowcase(harness.catalogShowcase, { toWarehouseId: CUSTOMER_WAREHOUSE_ID }, CUSTOMER_CALL);
    const shown = response.listings.find(item => item.id === listing.id);

    expect(shown?.quotes.map(quote => quote.quantity)).toEqual([shown?.minOrderQuantity]);
  });

  it('gives no quotes without a destination warehouse', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness);

    const list = await listFullShowcase(harness.catalogShowcase, {}, CUSTOMER_CALL);
    const one = await harness.catalogShowcase.getShowcaseListing({ listingId: listing.id }, CUSTOMER_CALL);

    expect(list.listings.find(item => item.id === listing.id)?.quotes).toEqual([]);
    expect(one.listing?.quotes).toEqual([]);
    expect(one.listing?.cityAvailability).toHaveLength(1);
  });

  it('answers not_found for a warehouse of another organization as for a missing one', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness);
    const foreign = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1;

    const failures = [
      await captureFailure(harness.catalogShowcase.listShowcaseListings({ toWarehouseId: foreign }, CUSTOMER_CALL)),
      await captureFailure(harness.catalogShowcase.listShowcaseListings({ toWarehouseId: UNKNOWN_ID }, CUSTOMER_CALL)),
      await captureFailure(harness.catalogShowcase.getShowcaseListing({ listingId: listing.id, toWarehouseId: foreign }, CUSTOMER_CALL)),
      await captureFailure(harness.catalogShowcase.getShowcaseListing({ listingId: listing.id, toWarehouseId: UNKNOWN_ID }, CUSTOMER_CALL)),
    ];

    for (const failure of failures) {
      expect(failure.code).toBe(ErrorCode.NOT_FOUND);
      expect(failure.entity).toBe(EntityKind.WAREHOUSE);
    }
  });
});

describe('the arrival date of a listing', () => {
  it('leaves the date empty beyond the business calendar and still answers', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness);

    await savePriceListEnd(harness, SUPPLIER_1_CALL, undefined);

    const beyondCalendar = createShowcaseClientAt(harness, Date.UTC(2028, 5, 1, 9));
    const withinCalendar = createShowcaseClientAt(harness, Date.UTC(2026, 9, 12, 9));
    const request = { listingId: listing.id, toWarehouseId: CUSTOMER_WAREHOUSE_ID };

    const late = await beyondCalendar.getShowcaseListing(request, CUSTOMER_CALL);
    const lateList = await listFullShowcase(beyondCalendar, { toWarehouseId: CUSTOMER_WAREHOUSE_ID }, CUSTOMER_CALL);
    const early = await withinCalendar.getShowcaseListing(request, CUSTOMER_CALL);

    expect(late.listing?.quotes).toHaveLength(1);
    expect(late.listing?.quotes[0]?.etaDate).toBeUndefined();
    expect(late.listing?.quotes[0]?.total?.amountMinor).toBe(early.listing?.quotes[0]?.total?.amountMinor);
    expect(lateList.listings.find(item => item.id === listing.id)?.quotes[0]?.etaDate).toBeUndefined();
    expect(early.listing?.quotes[0]?.etaDate).toBeDefined();
  });
});

describe('the limits of quantity and amounts', () => {
  it('passes the largest allowed quantity and price on the longest delivery through the real call and the binary encoding', async () => {
    const harness = createModuleHarness();
    const novosibirskWarehouseId = await addSupplierWarehouse(harness, SeedOrganizationId.SUPPLIER_1, NOVOSIBIRSK_LOCATION);

    await saveSalesTerms(harness, SUPPLIER_1_CALL, {
      ownDelivery: { minimumChargeMinor: MAX_CATALOG_AMOUNT_MINOR, pricePerKmMinor: MAX_CATALOG_AMOUNT_MINOR },
      preparationWorkingDays: 30,
    });

    const { listing } = await createShowcaseListing(harness, {
      listing: {
        availability: [buildAvailability(novosibirskWarehouseId, MAX_CATALOG_QUANTITY)],
        minOrderQuantity: MAX_CATALOG_QUANTITY,
        orderStep: 1n,
        priceUnit: create(PriceUnitSchema, { baseQuantity: 1n, name: 'шт.' }),
      },
      price: { tiers: [create(PriceTierSchema, { minQuantity: MAX_CATALOG_QUANTITY, price: buildRub(MAX_CATALOG_AMOUNT_MINOR) })] },
    });

    const one = await harness.catalogShowcase.getShowcaseListing(
      { listingId: listing.id, toWarehouseId: CUSTOMER_WAREHOUSE_ID },
      CUSTOMER_CALL,
    );
    const list = await listFullShowcase(harness.catalogShowcase, { toWarehouseId: CUSTOMER_WAREHOUSE_ID }, CUSTOMER_CALL);
    const [quote] = one.listing?.quotes ?? [];
    const goodsMinor = MAX_CATALOG_QUANTITY * MAX_CATALOG_AMOUNT_MINOR;
    const deliveryMinor = MAX_CATALOG_AMOUNT_MINOR * BigInt(quote?.distanceKm ?? 0);

    expect(quote?.distanceKm).toBeGreaterThan(1000);
    expect(quote?.goodsTotal?.amountMinor).toBe(goodsMinor);
    expect(quote?.total?.amountMinor).toBe(goodsMinor + deliveryMinor);
    expect(() => toBinary(DeliveryQuoteSchema, create(DeliveryQuoteSchema, quote))).not.toThrow();
    expect(list.listings.find(item => item.id === listing.id)?.quotes).toEqual(one.listing?.quotes);
  });
});
