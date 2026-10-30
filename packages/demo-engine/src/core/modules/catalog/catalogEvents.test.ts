import type { MessageInitShape } from '@bufbuild/protobuf';

import { create } from '@bufbuild/protobuf';
import {
  OrganizationProfileSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  marketChannel,
  organizationChannel,
} from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';

import { SeedOrganizationId } from '../../seed/index';
import { createModuleHarness } from '../testing/moduleHarness';
import {
  buildListingRequest,
  buildProductRequest,
  createListing,
  createPrice,
  createProduct,
  createPublishedListing,
  listCatalogEvents,
  nextUuid,
  SUPPLIER_1_CALL,
  SUPPLIER_5_CALL,
} from './testing/catalogFixtures';

const SUPPLIER_1_CHANNEL = organizationChannel(SeedOrganizationId.SUPPLIER_1);
const SUPPLIER_5_CHANNEL = organizationChannel(SeedOrganizationId.SUPPLIER_5);
const MARKET_CHANNEL = marketChannel();

interface CapturedValue<TResult> {
  channels: string[];
  result: TResult;
}

const capture = async <TResult>(harness: ModuleHarnessValue, work: () => Promise<TResult>): Promise<CapturedValue<TResult>> => {
  const before = listCatalogEvents(harness.events).length;
  const result = await work();

  return { channels: listCatalogEvents(harness.events).slice(before).map(event => event.channel), result };
};

const replaceSupplierProfiles = (
  harness: ModuleHarnessValue,
  profiles: MessageInitShape<typeof OrganizationProfileSchema>[],
): Promise<void> =>
  harness.runtime.command((transaction) => {
    const organization = transaction.get('organizations', SeedOrganizationId.SUPPLIER_1);

    if (organization === undefined) {
      throw new Error('The seed organization is missing');
    }

    organization.profiles = profiles.map(profile => create(OrganizationProfileSchema, profile));
    transaction.put('organizations', organization);
  });

describe('catalog change events', () => {
  it('reach the organization channel alone while nothing is published', async () => {
    const harness = createModuleHarness();

    const product = await capture(harness, () => createProduct(harness));
    const listing = await capture(harness, () => createListing(harness, product.result));
    const price = await capture(harness, () => createPrice(harness, listing.result));

    expect(product.channels).toEqual([SUPPLIER_1_CHANNEL]);
    expect(listing.channels).toEqual([SUPPLIER_1_CHANNEL]);
    expect(price.channels).toEqual([SUPPLIER_1_CHANNEL]);
  });

  it('reach the market channel when a published listing changes', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await createPublishedListing(harness);

    const editedProduct = await capture(harness, () => harness.catalog.saveProduct(
      buildProductRequest({ expectedVersion: product.version, name: 'Новое имя', productId: product.id, sku: product.sku }),
      SUPPLIER_1_CALL,
    ));
    const editedListing = await capture(harness, () => harness.catalog.saveListing(
      buildListingRequest(product.id, { expectedVersion: listing.version, listingId: listing.id }),
      SUPPLIER_1_CALL,
    ));
    const editedPrice = await capture(harness, () => createPrice(harness, listing, { expectedVersion: 1n }));

    expect(editedProduct.channels).toEqual([SUPPLIER_1_CHANNEL, MARKET_CHANNEL]);
    expect(editedListing.channels).toEqual([SUPPLIER_1_CHANNEL, MARKET_CHANNEL]);
    expect(editedPrice.channels).toEqual([SUPPLIER_1_CHANNEL, MARKET_CHANNEL]);
  });

  it('reach the market channel on publication changes only when the flag really changes', async () => {
    const harness = createModuleHarness();
    const { listing } = await createPublishedListing(harness);
    const setPublished = (isPublished: boolean, expectedVersion: bigint): Promise<unknown> => harness.catalog.setListingPublished(
      { expectedVersion, idempotencyKey: nextUuid(), isPublished, listingId: listing.id },
      SUPPLIER_1_CALL,
    );

    const unpublished = await capture(harness, () => setPublished(false, 2n));
    const unpublishedAgain = await capture(harness, () => setPublished(false, 3n));
    const published = await capture(harness, () => setPublished(true, 3n));

    expect(unpublished.channels).toEqual([SUPPLIER_1_CHANNEL, MARKET_CHANNEL]);
    expect(unpublishedAgain.channels).toEqual([SUPPLIER_1_CHANNEL]);
    expect(published.channels).toEqual([SUPPLIER_1_CHANNEL, MARKET_CHANNEL]);
  });

  it('reach the market channel for the price list and the sales terms only while a listing is published', async () => {
    const harness = createModuleHarness();
    const saveTerms = (expectedVersion = 0n): Promise<unknown> =>
      harness.catalog.saveSalesTerms({ expectedVersion, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);
    const savePriceList = (expectedVersion = 0n): Promise<unknown> =>
      harness.catalog.savePriceList({ expectedVersion, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);

    const priceListWithoutListing = await capture(harness, () => savePriceList());
    const salesTermsWithoutListing = await capture(harness, () => saveTerms());
    const { listing } = await createPublishedListing(harness);
    const priceList = await capture(harness, () => savePriceList(1n));
    const salesTerms = await capture(harness, () => saveTerms(1n));
    await harness.catalog.setListingPublished(
      { expectedVersion: listing.version, idempotencyKey: nextUuid(), isPublished: false, listingId: listing.id },
      SUPPLIER_1_CALL,
    );
    const priceListUnpublished = await capture(harness, () => savePriceList(2n));

    expect(priceListWithoutListing.channels).toEqual([SUPPLIER_1_CHANNEL]);
    expect(salesTermsWithoutListing.channels).toEqual([SUPPLIER_1_CHANNEL]);
    expect(priceList.channels).toEqual([SUPPLIER_1_CHANNEL, MARKET_CHANNEL]);
    expect(salesTerms.channels).toEqual([SUPPLIER_1_CHANNEL, MARKET_CHANNEL]);
    expect(priceListUnpublished.channels).toEqual([SUPPLIER_1_CHANNEL]);
  });

  it('carry the supplier id and no other data', async () => {
    const harness = createModuleHarness();
    await createPublishedListing(harness);
    const before = listCatalogEvents(harness.events).length;

    await harness.catalog.saveSalesTerms({ idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);

    const payloads = listCatalogEvents(harness.events).slice(before).map(event => (
      event.payload.case === 'listingsChanged' ? event.payload.value.supplierOrganizationId : ''
    ));

    expect(payloads).toEqual([SeedOrganizationId.SUPPLIER_1, SeedOrganizationId.SUPPLIER_1]);
  });

  it('stay off the market channel for a supplier that is not verified', async () => {
    const harness = createModuleHarness();
    await createPublishedListing(harness, SUPPLIER_5_CALL);

    const salesTerms = await capture(harness, () => harness.catalog.saveSalesTerms({ idempotencyKey: nextUuid() }, SUPPLIER_5_CALL));

    expect(salesTerms.channels).toEqual([SUPPLIER_5_CHANNEL]);
  });

  it('stay off the market channel when another profile is verified but the supplier profile is not', async () => {
    const harness = createModuleHarness();
    await createPublishedListing(harness);
    await replaceSupplierProfiles(harness, [
      { kind: ProfileKind.SUPPLIER, verificationLevel: 0 },
      { kind: ProfileKind.CARRIER, verificationLevel: 3 },
    ]);

    const salesTerms = await capture(harness, () => harness.catalog.saveSalesTerms({ idempotencyKey: nextUuid() }, SUPPLIER_1_CALL));

    expect(salesTerms.channels).toEqual([SUPPLIER_1_CHANNEL]);
  });

  it('are not repeated when a command is replayed under the same key', async () => {
    const harness = createModuleHarness();
    const request = { idempotencyKey: nextUuid() };
    await harness.catalog.saveSalesTerms(request, SUPPLIER_1_CALL);

    const replay = await capture(harness, () => harness.catalog.saveSalesTerms(request, SUPPLIER_1_CALL));

    expect(replay.channels).toEqual([]);
  });
});
