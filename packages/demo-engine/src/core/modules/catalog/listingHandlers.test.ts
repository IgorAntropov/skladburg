import type {
  Listing,
  Product,
  SaveListingRequest,
} from '@skladburg/contracts/catalog/v1/catalog';

import { create } from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  BaseUnit,
  PriceUnitSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';

import {
  SeedOrganizationId,
  SeedSphereId,
  SeedWarehouseId,
} from '../../seed/index';
import { createModuleHarness } from '../testing/moduleHarness';
import {
  buildAvailability,
  buildListingRequest,
  buildRub,
  captureFailure,
  createListing,
  createPrice,
  createProduct,
  createPublishedListing,
  listCatalogEvents,
  nextUuid,
  publishListing,
  SUPPLIER_1_CALL,
  SUPPLIER_2_CALL,
} from './testing/catalogFixtures';

interface PriceStateValue {
  baseQuantity: bigint | undefined;
  isPublished: boolean | undefined;
  listingVersion: bigint | undefined;
  priceVersion: bigint | undefined;
  productId: string | undefined;
  tierAmounts: (bigint | undefined)[] | undefined;
}

const requireListing = (listing: Listing | undefined): Listing => {
  if (listing === undefined) {
    throw new Error('The response was expected to carry a listing');
  }

  return listing;
};

describe('CatalogService.saveListing', () => {
  it('creates a draft at version 1 owned by the caller and keeps the published flag on edit', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await createPublishedListing(harness);

    const edited = await harness.catalog.saveListing(
      buildListingRequest(product.id, { expectedVersion: listing.version, listingId: listing.id, minOrderQuantity: 15n }),
      SUPPLIER_1_CALL,
    );

    expect(listing.tenantId).toBe(SeedOrganizationId.SUPPLIER_1);
    expect(edited.listing?.isPublished).toBe(true);
    expect(edited.listing?.version).toBe(listing.version + 1n);
    expect(harness.state.read.list('listings')).toHaveLength(1);
  });

  it('creates a listing as a draft', async () => {
    const harness = createModuleHarness();
    const listing = await createListing(harness, await createProduct(harness));

    expect(listing).toMatchObject({ isPublished: false, version: 1n });
  });

  it('answers not_found for a product that is foreign or missing', async () => {
    const harness = createModuleHarness();
    const foreign = await createProduct(harness, {}, SUPPLIER_2_CALL);

    const foreignFailure = await captureFailure(harness.catalog.saveListing(buildListingRequest(foreign.id), SUPPLIER_1_CALL));
    const missingFailure = await captureFailure(harness.catalog.saveListing(buildListingRequest(nextUuid()), SUPPLIER_1_CALL));

    expect(foreignFailure).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.PRODUCT });
    expect(missingFailure).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.PRODUCT });
  });

  it('hides a listing of another organization and reports version conflicts with the current version', async () => {
    const harness = createModuleHarness();
    const foreignProduct = await createProduct(harness, {}, SUPPLIER_2_CALL);
    const foreignListing = await createListing(harness, foreignProduct, {}, SUPPLIER_2_CALL);
    const product = await createProduct(harness);
    const listing = await createListing(harness, product);

    const foreignFailure = await captureFailure(harness.catalog.saveListing(
      buildListingRequest(product.id, { listingId: foreignListing.id }),
      SUPPLIER_1_CALL,
    ));
    const conflict = await captureFailure(harness.catalog.saveListing(
      buildListingRequest(product.id, { expectedVersion: 5n, listingId: listing.id }),
      SUPPLIER_1_CALL,
    ));
    const missing = await captureFailure(harness.catalog.saveListing(
      buildListingRequest(product.id, { expectedVersion: 1n }),
      SUPPLIER_1_CALL,
    ));

    expect(foreignFailure).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.LISTING });
    expect(conflict).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 1, entity: EntityKind.LISTING });
    expect(missing).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.LISTING });
    expect(harness.state.read.get('listings', foreignListing.id)?.tenantId).toBe(SeedOrganizationId.SUPPLIER_2);
  });

  it('replays a repeated key without a second listing or event', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness);
    const request = buildListingRequest(product.id);

    await harness.catalog.saveListing(request, SUPPLIER_1_CALL);
    const eventsAfterFirst = listCatalogEvents(harness.events).length;
    await harness.catalog.saveListing(request, SUPPLIER_1_CALL);

    expect(harness.state.read.list('listings')).toHaveLength(1);
    expect(listCatalogEvents(harness.events)).toHaveLength(eventsAfterFirst);
  });

  it('rejects a second listing for the same product', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness);
    await createListing(harness, product);

    const failure = await captureFailure(harness.catalog.saveListing(buildListingRequest(product.id), SUPPLIER_1_CALL));

    expect(failure.violations).toEqual([{ fieldPath: 'product_id', ruleId: 'catalog.listing_product_taken' }]);
  });

  it('collects every violation of the listing in a single error', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness);

    const failure = await captureFailure(harness.catalog.saveListing(
      buildListingRequest(product.id, {
        availability: [
          buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1, 0n, AvailabilityStatus.IN_STOCK),
          buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1, 5n),
          buildAvailability(SeedWarehouseId.SUPPLIER_2_WAREHOUSE_1, 5n),
        ],
        minOrderQuantity: 12n,
        sphereIds: [SeedSphereId.DAIRY, nextUuid()],
      }),
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([
      { fieldPath: 'sphere_ids[1]', ruleId: 'catalog.sphere_exists' },
      { fieldPath: 'availability[0].quantity', ruleId: 'catalog.availability_quantity_required' },
      { fieldPath: 'availability[1].warehouse_id', ruleId: 'catalog.warehouse_duplicate' },
      { fieldPath: 'availability[2].warehouse_id', ruleId: 'catalog.warehouse_exists' },
      { fieldPath: 'min_order_quantity', ruleId: 'catalog.min_order_not_multiple_of_step' },
    ]);
  });

  it('keeps at least one warehouse on a published listing', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await createPublishedListing(harness);

    const failure = await captureFailure(harness.catalog.saveListing(
      buildListingRequest(product.id, { availability: [], expectedVersion: listing.version, listingId: listing.id }),
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([{ fieldPath: 'availability', ruleId: 'catalog.listing_warehouse_required' }]);
  });

  it('refuses a minimum order that the first price tier would exceed', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness);
    const listing = await createListing(harness, product);
    await createPrice(harness, listing);

    const failure = await captureFailure(harness.catalog.saveListing(
      buildListingRequest(product.id, { expectedVersion: listing.version, listingId: listing.id, minOrderQuantity: 5n }),
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([{ fieldPath: 'min_order_quantity', ruleId: 'catalog.tier_above_minimum_order' }]);
  });
});

describe('CatalogService.saveListing price unit lock', () => {
  const readPriceState = (harness: ModuleHarnessValue, listingId: string): PriceStateValue => {
    const listing = harness.state.read.get('listings', listingId);
    const price = harness.state.read.get('listingPrices', listingId);

    return {
      baseQuantity: listing?.priceUnit?.baseQuantity,
      isPublished: listing?.isPublished,
      listingVersion: listing?.version,
      priceVersion: price?.version,
      productId: listing?.productId,
      tierAmounts: price?.tiers.map(entry => entry.price?.amountMinor),
    };
  };

  const buildLockedListing = async (harness: ModuleHarnessValue): Promise<{ listing: Listing; product: Product }> => {
    const product = await createProduct(harness, { minPrice: buildRub(8000n) });
    const listing = await createListing(harness, product);
    await createPrice(harness, listing);

    return { listing: await publishListing(harness, listing), product };
  };

  const buildUnitChange = (listing: Listing, product: Product, baseQuantity: bigint, name = 'кг'): SaveListingRequest =>
    buildListingRequest(product.id, {
      expectedVersion: listing.version,
      listingId: listing.id,
      priceUnit: create(PriceUnitSchema, { baseQuantity, name }),
    });

  it('refuses a changed price unit of a published listing whose tiers were checked against the minimum price', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await buildLockedListing(harness);
    const before = readPriceState(harness, listing.id);

    const failure = await captureFailure(harness.catalog.saveListing(buildUnitChange(listing, product, 1000n), SUPPLIER_1_CALL));

    expect(failure.violations).toEqual([{ fieldPath: 'price_unit.base_quantity', ruleId: 'catalog.price_unit_locked' }]);
    expect(readPriceState(harness, listing.id)).toEqual(before);
    expect(before).toMatchObject({ baseQuantity: 1n, listingVersion: 2n, priceVersion: 1n, tierAmounts: [9000n, 8500n] });
  });

  it('refuses a switch to another own product of a published listing with a price', async () => {
    const harness = createModuleHarness();
    const { listing } = await buildLockedListing(harness);
    const grams = await createProduct(harness, { baseUnit: BaseUnit.GRAM, sku: 'GRM' });
    const before = readPriceState(harness, listing.id);

    const failure = await captureFailure(harness.catalog.saveListing(
      buildListingRequest(grams.id, { expectedVersion: listing.version, listingId: listing.id }),
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([{ fieldPath: 'product_id', ruleId: 'catalog.listing_product_locked' }]);
    expect(readPriceState(harness, listing.id)).toEqual(before);
    expect(before.productId).not.toBe(grams.id);
  });

  it('keeps the lock after unpublishing and lets the same unit be published again', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await buildLockedListing(harness);
    const unpublished = await harness.catalog.setListingPublished(
      { expectedVersion: listing.version, idempotencyKey: nextUuid(), isPublished: false, listingId: listing.id },
      SUPPLIER_1_CALL,
    );
    const draft = requireListing(unpublished.listing);
    const before = readPriceState(harness, listing.id);

    const failure = await captureFailure(harness.catalog.saveListing(buildUnitChange(draft, product, 1000n), SUPPLIER_1_CALL));
    const republished = await publishListing(harness, draft);

    expect(failure.violations).toEqual([{ fieldPath: 'price_unit.base_quantity', ruleId: 'catalog.price_unit_locked' }]);
    expect(readPriceState(harness, listing.id)).toEqual({ ...before, isPublished: true, listingVersion: 4n });
    expect(republished.priceUnit?.baseQuantity).toBe(1n);
  });

  it('keeps the product lock after unpublishing', async () => {
    const harness = createModuleHarness();
    const { listing } = await buildLockedListing(harness);
    const unpublished = await harness.catalog.setListingPublished(
      { expectedVersion: listing.version, idempotencyKey: nextUuid(), isPublished: false, listingId: listing.id },
      SUPPLIER_1_CALL,
    );
    const draft = requireListing(unpublished.listing);
    const grams = await createProduct(harness, { baseUnit: BaseUnit.GRAM, sku: 'GRM' });
    const before = readPriceState(harness, listing.id);

    const failure = await captureFailure(harness.catalog.saveListing(
      buildListingRequest(grams.id, { expectedVersion: draft.version, listingId: listing.id }),
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([{ fieldPath: 'product_id', ruleId: 'catalog.listing_product_locked' }]);
    expect(readPriceState(harness, listing.id)).toEqual(before);
  });

  it('allows a new unit name with the same coefficient under a saved price', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await buildLockedListing(harness);

    const response = await harness.catalog.saveListing(buildUnitChange(listing, product, 1n, 'штука'), SUPPLIER_1_CALL);

    expect(response.listing?.priceUnit).toMatchObject({ baseQuantity: 1n, name: 'штука' });
    expect(response.listing?.version).toBe(listing.version + 1n);
  });

  it('allows a changed unit and a switched product while the listing has no price', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness);
    const grams = await createProduct(harness, { baseUnit: BaseUnit.GRAM, sku: 'GRM' });
    const listing = await createListing(harness, product);

    const unitChanged = await harness.catalog.saveListing(buildUnitChange(listing, product, 1000n), SUPPLIER_1_CALL);
    const switched = await harness.catalog.saveListing(
      buildListingRequest(grams.id, { expectedVersion: 2n, listingId: listing.id }),
      SUPPLIER_1_CALL,
    );

    expect(unitChanged.listing?.priceUnit?.baseQuantity).toBe(1000n);
    expect(switched.listing).toMatchObject({ productId: grams.id, version: 3n });
  });

  it('replays a saved listing after its price was set and refuses the same key with another unit', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness);
    const request = buildListingRequest(product.id);
    const first = await harness.catalog.saveListing(request, SUPPLIER_1_CALL);
    await createPrice(harness, requireListing(first.listing));
    const eventsAfterPrice = listCatalogEvents(harness.events).length;
    const before = readPriceState(harness, request.listingId);

    const replay = await harness.catalog.saveListing(request, SUPPLIER_1_CALL);
    const reused = await captureFailure(harness.catalog.saveListing(
      buildListingRequest(product.id, {
        idempotencyKey: request.idempotencyKey,
        listingId: request.listingId,
        priceUnit: create(PriceUnitSchema, { baseQuantity: 1000n, name: 'кг' }),
      }),
      SUPPLIER_1_CALL,
    ));

    expect(replay.listing).toEqual(first.listing);
    expect(reused.code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    expect(readPriceState(harness, request.listingId)).toEqual(before);
    expect(listCatalogEvents(harness.events)).toHaveLength(eventsAfterPrice);
  });
});

describe('CatalogService.setListingPublished', () => {
  it('publishes a listing with a warehouse and a price and unpublishes it without conditions', async () => {
    const harness = createModuleHarness();
    const { listing } = await createPublishedListing(harness);

    const unpublished = await harness.catalog.setListingPublished(
      { expectedVersion: listing.version, idempotencyKey: nextUuid(), isPublished: false, listingId: listing.id },
      SUPPLIER_1_CALL,
    );

    expect(listing).toMatchObject({ isPublished: true, version: 2n });
    expect(unpublished.listing).toMatchObject({ isPublished: false, version: 3n });
  });

  it('reports both the missing warehouse and the missing price', async () => {
    const harness = createModuleHarness();
    const listing = await createListing(harness, await createProduct(harness), { availability: [] });

    const failure = await captureFailure(harness.catalog.setListingPublished(
      { expectedVersion: listing.version, idempotencyKey: nextUuid(), isPublished: true, listingId: listing.id },
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([
      { fieldPath: 'is_published', ruleId: 'catalog.listing_warehouse_required' },
      { fieldPath: 'is_published', ruleId: 'catalog.listing_price_required' },
    ]);
  });

  it('reports only the missing price when the warehouse is set', async () => {
    const harness = createModuleHarness();
    const listing = await createListing(harness, await createProduct(harness));

    const failure = await captureFailure(harness.catalog.setListingPublished(
      { expectedVersion: listing.version, idempotencyKey: nextUuid(), isPublished: true, listingId: listing.id },
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([{ fieldPath: 'is_published', ruleId: 'catalog.listing_price_required' }]);
  });

  it('does not touch the version when the flag is already set', async () => {
    const harness = createModuleHarness();
    const { listing } = await createPublishedListing(harness);

    const response = await harness.catalog.setListingPublished(
      { expectedVersion: listing.version, idempotencyKey: nextUuid(), isPublished: true, listingId: listing.id },
      SUPPLIER_1_CALL,
    );

    expect(response.listing?.version).toBe(listing.version);
  });

  it('hides a listing of another organization and checks the version', async () => {
    const harness = createModuleHarness();
    const { listing: foreign } = await createPublishedListing(harness, SUPPLIER_2_CALL);
    const { listing } = await createPublishedListing(harness);

    const foreignFailure = await captureFailure(harness.catalog.setListingPublished(
      { expectedVersion: foreign.version, idempotencyKey: nextUuid(), isPublished: false, listingId: foreign.id },
      SUPPLIER_1_CALL,
    ));
    const conflict = await captureFailure(harness.catalog.setListingPublished(
      { expectedVersion: 1n, idempotencyKey: nextUuid(), isPublished: false, listingId: listing.id },
      SUPPLIER_1_CALL,
    ));

    expect(foreignFailure).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.LISTING });
    expect(conflict).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 2, entity: EntityKind.LISTING });
    expect(harness.state.read.get('listings', foreign.id)?.isPublished).toBe(true);
  });

  it('replays a repeated key without a second version bump or event', async () => {
    const harness = createModuleHarness();
    const listing = await createListing(harness, await createProduct(harness));
    await createPrice(harness, listing);
    const request = { expectedVersion: listing.version, idempotencyKey: nextUuid(), isPublished: true, listingId: listing.id };

    await harness.catalog.setListingPublished(request, SUPPLIER_1_CALL);
    const eventsAfterFirst = listCatalogEvents(harness.events).length;
    const replay = await harness.catalog.setListingPublished(request, SUPPLIER_1_CALL);

    expect(replay.listing?.version).toBe(2n);
    expect(harness.state.read.get('listings', listing.id)?.version).toBe(2n);
    expect(listCatalogEvents(harness.events)).toHaveLength(eventsAfterFirst);
  });
});

describe('CatalogService.getOwnListing and listOwnListings', () => {
  it('returns an own listing together with its product', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await createPublishedListing(harness);

    const response = await harness.catalog.getOwnListing({ listingId: listing.id }, SUPPLIER_1_CALL);

    expect(response.listing?.listing?.id).toBe(listing.id);
    expect(response.listing?.product?.id).toBe(product.id);
  });

  it('answers not_found for a foreign or missing listing', async () => {
    const harness = createModuleHarness();
    const { listing: foreign } = await createPublishedListing(harness, SUPPLIER_2_CALL);

    const foreignFailure = await captureFailure(harness.catalog.getOwnListing({ listingId: foreign.id }, SUPPLIER_1_CALL));
    const missingFailure = await captureFailure(harness.catalog.getOwnListing({ listingId: nextUuid() }, SUPPLIER_1_CALL));

    expect(foreignFailure).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.LISTING });
    expect(missingFailure).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.LISTING });
  });

  it('lists only own listings ordered by product name and filtered by the query', async () => {
    const harness = createModuleHarness();
    const second = await createProduct(harness, { name: 'Ряженка', sku: 'RJ' });
    const first = await createProduct(harness, { name: 'Айран', sku: 'AY' });
    const foreign = await createProduct(harness, { name: 'Бринза', sku: 'BR' }, SUPPLIER_2_CALL);
    await createListing(harness, second);
    await createListing(harness, first);
    await createListing(harness, foreign, {}, SUPPLIER_2_CALL);

    const all = await harness.catalog.listOwnListings({}, SUPPLIER_1_CALL);
    const filtered = await harness.catalog.listOwnListings({ query: 'ряж' }, SUPPLIER_1_CALL);
    const paged = await harness.catalog.listOwnListings({ page: { pageSize: 1 } }, SUPPLIER_1_CALL);

    expect(all.listings.map(entry => entry.product?.name)).toEqual(['Айран', 'Ряженка']);
    expect(all.listings.every(entry => entry.listing?.tenantId === SeedOrganizationId.SUPPLIER_1)).toBe(true);
    expect(filtered.listings.map(entry => entry.product?.sku)).toEqual(['RJ']);
    expect(paged.listings).toHaveLength(1);
    expect(paged.page?.nextPageToken).not.toBe('');
  });
});
