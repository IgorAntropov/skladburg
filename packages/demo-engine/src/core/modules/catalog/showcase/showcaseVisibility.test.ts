import {
  create,
  toJson,
} from '@bufbuild/protobuf';
import { ListingSchema } from '@skladburg/contracts/catalog/v1/catalog';
import {
  GetShowcaseListingResponseSchema,
  ListShowcaseListingsResponseSchema,
  ShowcaseService,
} from '@skladburg/contracts/catalog/v1/showcase';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../../testing/moduleHarness';

import {
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../../seed/index';
import {
  callForOutcome,
  createModuleHarness,
} from '../../testing/moduleHarness';
import {
  buildAvailability,
  buildRub,
  captureFailure,
  listFullShowcase,
  SUPPLIER_1_CALL,
  SUPPLIER_5_CALL,
} from '../testing/catalogFixtures';
import {
  CARRIER_CALL,
  collectJsonKeys,
  createShowcaseClientAt,
  createShowcaseListing,
  createSupplierViewerCall,
  CUSTOMER_CALL,
  CUSTOMER_WAREHOUSE_ID,
  savePriceListEnd,
  setProfiles,
} from './testing/showcaseFixtures';

const readOwnListingIds = async (harness: ModuleHarnessValue): Promise<string[]> => {
  const response = await harness.catalog.listOwnListings({}, SUPPLIER_1_CALL);

  return response.listings.flatMap(item => (item.listing === undefined ? [] : [item.listing.id]));
};

const listIds = (listings: readonly { id: string }[]): string[] => listings.map(listing => listing.id);

describe('who sees a listing on the showcase', () => {
  it('shows a published priced listing of a verified supplier to a verified customer', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await createShowcaseListing(harness);

    const response = await listFullShowcase(harness.catalogShowcase, {}, CUSTOMER_CALL);
    const shown = response.listings.find(candidate => candidate.id === listing.id);

    expect(shown?.productName).toBe(product.name);
    expect(shown?.supplier?.organizationId).toBe(SeedOrganizationId.SUPPLIER_1);
    expect(shown?.supplier?.verificationLevel).toBe(2);
  });

  it('does not show a draft', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness, { isDraft: true });

    const response = await listFullShowcase(harness.catalogShowcase, {}, CUSTOMER_CALL);

    expect(listIds(response.listings)).not.toContain(listing.id);
  });

  it('does not show a published listing that has no price', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness, { hasPrice: false, isDraft: true });
    const published = create(ListingSchema, listing);

    published.isPublished = true;
    await harness.runtime.command((transaction) => {
      transaction.put('listings', published);
    });

    const response = await listFullShowcase(harness.catalogShowcase, {}, CUSTOMER_CALL);
    const failure = await captureFailure(harness.catalogShowcase.getShowcaseListing({ listingId: listing.id }, CUSTOMER_CALL));

    expect(listIds(response.listings)).not.toContain(listing.id);
    expect(failure.entity).toBe(EntityKind.LISTING);
  });

  it('does not show the listing to the supplier that owns it', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness);
    const ownerCall = await createSupplierViewerCall(harness, SeedOrganizationId.SUPPLIER_1, [
      { kind: ProfileKind.SUPPLIER, verificationLevel: 2 },
      { kind: ProfileKind.CUSTOMER, verificationLevel: 2 },
    ]);

    const response = await listFullShowcase(harness.catalogShowcase, {}, ownerCall);
    const failure = await captureFailure(harness.catalogShowcase.getShowcaseListing({ listingId: listing.id }, ownerCall));
    const ownIds = await readOwnListingIds(harness);

    expect(listIds(response.listings)).not.toContain(listing.id);
    expect(failure.entity).toBe(EntityKind.LISTING);
    expect(ownIds).toContain(listing.id);
  });

  it('hides a listing after the price list ends and keeps it in the list of the supplier', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness);

    await savePriceListEnd(harness, SUPPLIER_1_CALL, { day: 11, month: 10, year: 2026 });

    const response = await listFullShowcase(harness.catalogShowcase, {}, CUSTOMER_CALL);
    const failure = await captureFailure(harness.catalogShowcase.getShowcaseListing({ listingId: listing.id }, CUSTOMER_CALL));
    const ownIds = await readOwnListingIds(harness);

    expect(listIds(response.listings)).not.toContain(listing.id);
    expect(failure.entity).toBe(EntityKind.LISTING);
    expect(ownIds).toContain(listing.id);
  });

  it('keeps the listing on the last day of the price list and hides it on the next day', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness);
    const lastDayMs = Date.UTC(2026, 9, 31, 9);
    const nextDayMs = Date.UTC(2026, 10, 1, 9);

    await savePriceListEnd(harness, SUPPLIER_1_CALL, { day: 31, month: 10, year: 2026 });

    const onLastDay = await listFullShowcase(createShowcaseClientAt(harness, lastDayMs), {}, CUSTOMER_CALL);
    const onNextDay = await listFullShowcase(createShowcaseClientAt(harness, nextDayMs), {}, CUSTOMER_CALL);

    expect(listIds(onLastDay.listings)).toContain(listing.id);
    expect(listIds(onNextDay.listings)).not.toContain(listing.id);
  });

  it('counts the last day in the time zone of the destination warehouse', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness);
    const lateEveningUtcMs = Date.UTC(2026, 9, 12, 21, 30);
    const client = createShowcaseClientAt(harness, lateEveningUtcMs);

    await savePriceListEnd(harness, SUPPLIER_1_CALL, { day: 12, month: 10, year: 2026 });

    const withoutWarehouse = await listFullShowcase(client, {}, CUSTOMER_CALL);
    const withWarehouse = await listFullShowcase(client, { toWarehouseId: CUSTOMER_WAREHOUSE_ID }, CUSTOMER_CALL);

    expect(listIds(withoutWarehouse.listings)).toContain(listing.id);
    expect(listIds(withWarehouse.listings)).not.toContain(listing.id);
  });

  it('hides the catalog of a supplier whose supplier profile is not verified', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness, { call: SUPPLIER_5_CALL });

    const response = await listFullShowcase(harness.catalogShowcase, {}, CUSTOMER_CALL);
    const failure = await captureFailure(harness.catalogShowcase.getShowcaseListing({ listingId: listing.id }, CUSTOMER_CALL));

    expect(listIds(response.listings)).not.toContain(listing.id);
    expect(failure.entity).toBe(EntityKind.LISTING);
  });

  it('hides the catalog of an organization with a verified carrier and an unverified supplier profile', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness);

    await setProfiles(harness, SeedOrganizationId.SUPPLIER_1, [
      { kind: ProfileKind.SUPPLIER, verificationLevel: 0 },
      { kind: ProfileKind.CARRIER, verificationLevel: 3 },
    ]);

    const response = await listFullShowcase(harness.catalogShowcase, {}, CUSTOMER_CALL);

    expect(listIds(response.listings)).not.toContain(listing.id);
  });

  it('shows nothing to an unverified customer and answers not_found for a listing', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness);

    await setProfiles(harness, SeedOrganizationId.CUSTOMER_1, [{ kind: ProfileKind.CUSTOMER, verificationLevel: 0 }]);

    const response = await listFullShowcase(harness.catalogShowcase, {}, CUSTOMER_CALL);
    const failure = await captureFailure(harness.catalogShowcase.getShowcaseListing({ listingId: listing.id }, CUSTOMER_CALL));

    expect(response.listings).toEqual([]);
    expect(failure.code).toBe(ErrorCode.NOT_FOUND);
    expect(failure.entity).toBe(EntityKind.LISTING);
  });

  it('denies a carrier and a supplier with permission_denied naming marketplace_view', async () => {
    const harness = createModuleHarness();
    const methods = [ShowcaseService.method.listShowcaseListings, ShowcaseService.method.getShowcaseListing];

    for (const call of [CARRIER_CALL, SUPPLIER_1_CALL]) {
      for (const method of methods) {
        expect(await callForOutcome(harness.transport, method, call)).toEqual({
          code: ErrorCode.PERMISSION_DENIED,
          permission: 'marketplace_view',
        });
      }
    }
  });
});

describe('what the showcase does not reveal', () => {
  const PRIVATE_KEYS = [
    'availability',
    'isDiscountForbidden',
    'isPublished',
    'mapNodeId',
    'markingMode',
    'minPrice',
    'priceListId',
    'sku',
    'tenantId',
    'version',
    'warehouseId',
  ];

  const createRichListing = async (harness: ModuleHarnessValue): Promise<string> => {
    const { listing } = await createShowcaseListing(harness, {
      listing: {
        availability: [
          buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1),
          buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_2),
        ],
      },
      product: { isDiscountForbidden: true, minPrice: buildRub(1000n) },
    });

    return listing.id;
  };

  it('keeps private fields out of the list', async () => {
    const harness = createModuleHarness();
    const listingId = await createRichListing(harness);

    const response = await listFullShowcase(harness.catalogShowcase, { toWarehouseId: CUSTOMER_WAREHOUSE_ID }, CUSTOMER_CALL);
    const keys = collectJsonKeys(toJson(ListShowcaseListingsResponseSchema, response));

    expect(listIds(response.listings)).toContain(listingId);
    expect(keys).toContain('productName');
    expect(keys).toContain('quotes');
    for (const privateKey of PRIVATE_KEYS) {
      expect(keys).not.toContain(privateKey);
    }
  });

  it('keeps private fields out of one listing', async () => {
    const harness = createModuleHarness();
    const listingId = await createRichListing(harness);

    const response = await harness.catalogShowcase.getShowcaseListing(
      { listingId, toWarehouseId: CUSTOMER_WAREHOUSE_ID },
      CUSTOMER_CALL,
    );
    const keys = collectJsonKeys(toJson(GetShowcaseListingResponseSchema, response));

    expect(keys).toContain('cityAvailability');
    for (const privateKey of PRIVATE_KEYS) {
      expect(keys).not.toContain(privateKey);
    }
  });
});
