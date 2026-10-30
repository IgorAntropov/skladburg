import type { PriceTier } from '@skladburg/contracts/catalog/v1/catalog';

import { create } from '@bufbuild/protobuf';
import {
  PriceTierSchema,
  PriceUnitSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { SeedOrganizationId } from '../../seed/index';
import { createModuleHarness } from '../testing/moduleHarness';
import {
  buildPriceRequest,
  buildRub,
  captureFailure,
  createListing,
  createPrice,
  createProduct,
  listCatalogEvents,
  nextUuid,
  SUPPLIER_1_CALL,
  SUPPLIER_2_CALL,
} from './testing/catalogFixtures';

const tier = (minQuantity: bigint, amountMinor: bigint): PriceTier =>
  create(PriceTierSchema, { minQuantity, price: buildRub(amountMinor) });

describe('CatalogService.saveListingPrice', () => {
  it('creates the base price list with the first price and reuses it for the next ones', async () => {
    const harness = createModuleHarness();
    const firstListing = await createListing(harness, await createProduct(harness, { sku: 'P-1' }));
    const secondListing = await createListing(harness, await createProduct(harness, { sku: 'P-2' }));

    const first = await createPrice(harness, firstListing);
    const second = await createPrice(harness, secondListing);
    const [priceList] = harness.state.read.listBy('priceLists', 'tenantId', SeedOrganizationId.SUPPLIER_1);

    expect(harness.state.read.list('priceLists')).toHaveLength(1);
    expect(priceList).toMatchObject({ tenantId: SeedOrganizationId.SUPPLIER_1, version: 1n });
    expect(first.priceListId).toBe(priceList?.id);
    expect(second.priceListId).toBe(priceList?.id);
    expect(first).toMatchObject({ tenantId: SeedOrganizationId.SUPPLIER_1, version: 1n });
  });

  it('replaces the tiers and bumps the row version', async () => {
    const harness = createModuleHarness();
    const listing = await createListing(harness, await createProduct(harness));
    const created = await createPrice(harness, listing);

    const edited = await createPrice(harness, listing, { expectedVersion: created.version, tiers: [tier(10n, 7000n)] });

    expect(edited.version).toBe(2n);
    expect(edited.tiers.map(entry => entry.price?.amountMinor)).toEqual([7000n]);
    expect(edited.priceListId).toBe(created.priceListId);
  });

  it('reports a version conflict with version 0 when the row does not exist yet', async () => {
    const harness = createModuleHarness();
    const listing = await createListing(harness, await createProduct(harness));

    const failure = await captureFailure(
      harness.catalog.saveListingPrice(buildPriceRequest(listing.id, { expectedVersion: 2n }), SUPPLIER_1_CALL),
    );

    expect(failure).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 0, entity: EntityKind.PRICE_LIST });
  });

  it('refuses creation over an existing row with its current version', async () => {
    const harness = createModuleHarness();
    const listing = await createListing(harness, await createProduct(harness));
    await createPrice(harness, listing);

    const failure = await captureFailure(harness.catalog.saveListingPrice(buildPriceRequest(listing.id), SUPPLIER_1_CALL));

    expect(failure).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 1, entity: EntityKind.PRICE_LIST });
  });

  it('answers not_found for a listing that is foreign or missing and creates nothing', async () => {
    const harness = createModuleHarness();
    const foreign = await createListing(harness, await createProduct(harness, {}, SUPPLIER_2_CALL), {}, SUPPLIER_2_CALL);

    const foreignFailure = await captureFailure(harness.catalog.saveListingPrice(buildPriceRequest(foreign.id), SUPPLIER_1_CALL));
    const missingFailure = await captureFailure(harness.catalog.saveListingPrice(buildPriceRequest(nextUuid()), SUPPLIER_1_CALL));

    expect(foreignFailure).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.LISTING });
    expect(missingFailure).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.LISTING });
    expect(harness.state.read.list('listingPrices')).toEqual([]);
    expect(harness.state.read.list('priceLists')).toEqual([]);
  });

  it('rejects the tiers against the listing and the product and leaves no price list behind', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness, { minPrice: buildRub(8000n) });
    const listing = await createListing(harness, product);

    const failure = await captureFailure(harness.catalog.saveListingPrice(
      buildPriceRequest(listing.id, {
        tiers: [
          create(PriceTierSchema, { minQuantity: 20n, price: create(MoneySchema, { amountMinor: 9000n, currencyCode: 'EUR' }) }),
          tier(20n, 7900n),
        ],
      }),
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([
      { fieldPath: 'tiers[0].price.currency_code', ruleId: 'money.currency_unsupported' },
      { fieldPath: 'tiers[1].min_quantity', ruleId: 'catalog.tier_order' },
      { fieldPath: 'tiers[1].price.amount_minor', ruleId: 'catalog.price_below_minimum' },
      { fieldPath: 'tiers[0].min_quantity', ruleId: 'catalog.tier_above_minimum_order' },
    ]);
    expect(harness.state.read.list('priceLists')).toEqual([]);
  });

  it('compares the tiers with the minimum price in the unit that stays locked', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness, { minPrice: buildRub(8000n) });
    const listing = await createListing(harness, product, { priceUnit: create(PriceUnitSchema, { baseQuantity: 1000n, name: 'кг' }) });
    const created = await createPrice(harness, listing);

    const failure = await captureFailure(harness.catalog.saveListingPrice(
      buildPriceRequest(listing.id, { expectedVersion: created.version, tiers: [tier(10n, 7900n)] }),
      SUPPLIER_1_CALL,
    ));
    const edited = await createPrice(harness, listing, { expectedVersion: created.version, tiers: [tier(10n, 8000n)] });

    expect(failure.violations).toEqual([{ fieldPath: 'tiers[0].price.amount_minor', ruleId: 'catalog.price_below_minimum' }]);
    expect(edited.version).toBe(2n);
    expect(harness.state.read.get('listings', listing.id)?.priceUnit?.baseQuantity).toBe(1000n);
  });

  it('replays a repeated key without a second row, version bump or event', async () => {
    const harness = createModuleHarness();
    const listing = await createListing(harness, await createProduct(harness));
    const request = buildPriceRequest(listing.id);

    await harness.catalog.saveListingPrice(request, SUPPLIER_1_CALL);
    const eventsAfterFirst = listCatalogEvents(harness.events).length;
    const replay = await harness.catalog.saveListingPrice(request, SUPPLIER_1_CALL);

    expect(replay.price?.version).toBe(1n);
    expect(harness.state.read.list('listingPrices')).toHaveLength(1);
    expect(listCatalogEvents(harness.events)).toHaveLength(eventsAfterFirst);
  });
});

describe('CatalogService.listListingPrices', () => {
  it('returns own rows, narrows them to the requested listings and skips foreign ids', async () => {
    const harness = createModuleHarness();
    const first = await createListing(harness, await createProduct(harness, { sku: 'L-1' }));
    const second = await createListing(harness, await createProduct(harness, { sku: 'L-2' }));
    const foreign = await createListing(harness, await createProduct(harness, {}, SUPPLIER_2_CALL), {}, SUPPLIER_2_CALL);
    await createPrice(harness, first);
    await createPrice(harness, second);
    await createPrice(harness, foreign, {}, SUPPLIER_2_CALL);

    const all = await harness.catalog.listListingPrices({}, SUPPLIER_1_CALL);
    const narrowed = await harness.catalog.listListingPrices({ listingIds: [second.id, foreign.id] }, SUPPLIER_1_CALL);

    expect(all.prices.map(price => price.listingId).sort()).toEqual([first.id, second.id].sort());
    expect(all.prices.every(price => price.tenantId === SeedOrganizationId.SUPPLIER_1)).toBe(true);
    expect(narrowed.prices.map(price => price.listingId)).toEqual([second.id]);
  });

  it('pages through the rows ordered by listing id', async () => {
    const harness = createModuleHarness();
    const listings = [
      await createListing(harness, await createProduct(harness, { sku: 'Q-1' })),
      await createListing(harness, await createProduct(harness, { sku: 'Q-2' })),
      await createListing(harness, await createProduct(harness, { sku: 'Q-3' })),
    ];

    for (const listing of listings) {
      await createPrice(harness, listing);
    }

    const first = await harness.catalog.listListingPrices({ page: { pageSize: 2 } }, SUPPLIER_1_CALL);
    const second = await harness.catalog.listListingPrices(
      { page: { pageSize: 2, pageToken: first.page?.nextPageToken } },
      SUPPLIER_1_CALL,
    );

    expect([...first.prices, ...second.prices].map(price => price.listingId)).toEqual(listings.map(listing => listing.id).sort());
    expect(second.page?.nextPageToken).toBe('');
  });
});

describe('CatalogService.getPriceList and savePriceList', () => {
  it('returns an empty price list at version 0 when nothing is saved', async () => {
    const harness = createModuleHarness();

    const response = await harness.catalog.getPriceList({}, SUPPLIER_1_CALL);

    expect(response.priceList).toMatchObject({ id: '', tenantId: SeedOrganizationId.SUPPLIER_1, version: 0n });
    expect(response.priceList?.validUntil).toBeUndefined();
  });

  it('creates the single price list, edits it and lets the validity be cleared', async () => {
    const harness = createModuleHarness();
    const created = await harness.catalog.savePriceList(
      { idempotencyKey: nextUuid(), validUntil: { day: 31, month: 12, year: 2027 } },
      SUPPLIER_1_CALL,
    );
    const edited = await harness.catalog.savePriceList({ expectedVersion: 1n, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);
    const read = await harness.catalog.getPriceList({}, SUPPLIER_1_CALL);

    expect(created.priceList).toMatchObject({ tenantId: SeedOrganizationId.SUPPLIER_1, version: 1n });
    expect(created.priceList?.validUntil).toMatchObject({ day: 31, month: 12, year: 2027 });
    expect(edited.priceList).toMatchObject({ id: created.priceList?.id, version: 2n });
    expect(read.priceList?.validUntil).toBeUndefined();
    expect(harness.state.read.list('priceLists')).toHaveLength(1);
  });

  it('edits the price list that the first price created', async () => {
    const harness = createModuleHarness();
    const price = await createPrice(harness, await createListing(harness, await createProduct(harness)));

    const edited = await harness.catalog.savePriceList({ expectedVersion: 1n, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);

    expect(edited.priceList?.id).toBe(price.priceListId);
  });

  it('reports conflicts and the initial version of a missing list', async () => {
    const harness = createModuleHarness();
    const missing = await captureFailure(
      harness.catalog.savePriceList({ expectedVersion: 1n, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL),
    );
    await harness.catalog.savePriceList({ idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);
    const duplicate = await captureFailure(harness.catalog.savePriceList({ idempotencyKey: nextUuid() }, SUPPLIER_1_CALL));
    const stale = await captureFailure(
      harness.catalog.savePriceList({ expectedVersion: 7n, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL),
    );

    expect(missing).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 0, entity: EntityKind.PRICE_LIST });
    expect(duplicate).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 1, entity: EntityKind.PRICE_LIST });
    expect(stale).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 1, entity: EntityKind.PRICE_LIST });
  });

  it('keeps the price list of each organization apart', async () => {
    const harness = createModuleHarness();
    await harness.catalog.savePriceList({ idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);

    const other = await harness.catalog.getPriceList({}, SUPPLIER_2_CALL);
    const created = await harness.catalog.savePriceList({ idempotencyKey: nextUuid() }, SUPPLIER_2_CALL);

    expect(other.priceList).toMatchObject({ id: '', tenantId: SeedOrganizationId.SUPPLIER_2, version: 0n });
    expect(created.priceList?.version).toBe(1n);
    expect(harness.state.read.list('priceLists')).toHaveLength(2);
  });

  it('replays a repeated key without a second price list or event', async () => {
    const harness = createModuleHarness();
    const request = { idempotencyKey: nextUuid() };

    await harness.catalog.savePriceList(request, SUPPLIER_1_CALL);
    const eventsAfterFirst = listCatalogEvents(harness.events).length;
    await harness.catalog.savePriceList(request, SUPPLIER_1_CALL);

    expect(harness.state.read.list('priceLists')).toHaveLength(1);
    expect(listCatalogEvents(harness.events)).toHaveLength(eventsAfterFirst);
  });
});
