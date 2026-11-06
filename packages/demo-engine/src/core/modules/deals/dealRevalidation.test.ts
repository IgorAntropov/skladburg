import { create } from '@bufbuild/protobuf';
import {
  BaseUnit,
  SaveProductRequestSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  OrganizationProfileSchema,
  OrganizationSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/index';
import {
  addSupplierWarehouse,
  CUSTOMER_CALL,
  VORONEZH_LOCATION,
} from '../catalog/showcase/testing/showcaseFixtures';
import {
  buildRub,
  captureFailure,
  createProduct,
  GTIN_ONE,
  nextUuid,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import {
  addTestMember,
  callAs,
} from '../testing/moduleHarness';
import {
  counterSubmittedDeal,
  createDealFixture,
  createSubmittedDeal,
} from './testing/dealFixtures';

const raiseMinimumPrice = async (harness: Awaited<ReturnType<typeof createDealFixture>>['harness'], listingId: string): Promise<void> => {
  const listing = (await harness.catalog.getOwnListing({ listingId }, SUPPLIER_1_CALL)).listing;
  const product = listing?.product;
  if (product === undefined) {
    throw new Error('Missing product');
  }
  await harness.catalog.saveListingPrice({
    expectedVersion: harness.state.read.get('listingPrices', listingId)?.version,
    idempotencyKey: nextUuid(), listingId, tiers: [{ minQuantity: 10n, price: buildRub(9000n) }],
  }, SUPPLIER_1_CALL);
  await harness.catalog.saveProduct(create(SaveProductRequestSchema, {
    baseUnit: product.baseUnit, expectedVersion: product.version, gtin: product.gtin, idempotencyKey: nextUuid(),
    markingMode: product.markingMode, minPrice: buildRub(8700n), name: product.name, packagings: product.packagings,
    productId: product.id, shelfLifeDays: product.shelfLifeDays, sku: product.sku, vatRate: product.vatRate,
  }), SUPPLIER_1_CALL);
};

describe('deal live business revalidation', () => {
  it('checks supplier verification again after submission', async () => {
    const { harness, request } = await createDealFixture();
    const submitted = await createSubmittedDeal(harness, request);
    await harness.runtime.command((transaction) => {
      const supplier = create(OrganizationSchema, transaction.get('organizations', SeedOrganizationId.SUPPLIER_1));
      supplier.profiles = supplier.profiles.map(profile => ({ ...profile, verificationLevel: 0 }));
      transaction.put('organizations', supplier);
    });
    const failure = await captureFailure(harness.deal.confirmDeal({
      dealId: submitted.id, expectedVersion: submitted.version, goodsTotal: submitted.goodsTotal,
      idempotencyKey: nextUuid(), shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
    }, SUPPLIER_1_CALL));
    expect(failure.code).toBe(ErrorCode.NOT_FOUND);
    expect(harness.state.read.get('deals', submitted.id)?.status).toBe(DealStatus.SUBMITTED);
  });

  it.each(['organization', 'city'])('rejects a shipment warehouse of a different %s', async (difference) => {
    const { harness, request } = await createDealFixture();
    const submitted = await createSubmittedDeal(harness, request);
    const shipFromWarehouseId = difference === 'organization'
      ? SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1
      : await addSupplierWarehouse(harness, SeedOrganizationId.SUPPLIER_1, VORONEZH_LOCATION);
    const failure = await captureFailure(harness.deal.confirmDeal({
      dealId: submitted.id, expectedVersion: submitted.version, goodsTotal: submitted.goodsTotal,
      idempotencyKey: nextUuid(), shipFromWarehouseId,
    }, SUPPLIER_1_CALL));
    expect(failure.violations[0]?.ruleId).toBe('deal.warehouse.unavailable');
  });

  it.each(['counter', 'accept'])('enforces a current product minimum at %s', async (stage) => {
    const { harness, request } = await createDealFixture();
    const submitted = await createSubmittedDeal(harness, request);
    if (stage === 'counter') {
      await raiseMinimumPrice(harness, submitted.lines[0]?.listingId ?? '');
      const failure = await captureFailure(counterSubmittedDeal(harness, submitted));
      expect(failure.violations[0]?.ruleId).toBe('deal.price.below_minimum');
    }
    else {
      const pending = await counterSubmittedDeal(harness, submitted);
      await raiseMinimumPrice(harness, pending.lines[0]?.listingId ?? '');
      const failure = await captureFailure(harness.deal.acceptCounterOffer({
        dealId: pending.id, expectedVersion: pending.version, goodsTotal: pending.counterOffer?.goodsTotal, idempotencyKey: nextUuid(),
      }, CUSTOMER_CALL));
      expect(failure.violations[0]?.ruleId).toBe('deal.price.below_minimum');
    }
  });

  it.each([BaseUnit.PIECE, BaseUnit.GRAM])('matches a normalized GTIN only with a compatible unit %s', async (baseUnit) => {
    const { harness, request } = await createDealFixture({ product: { gtin: GTIN_ONE } });
    const editorId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1, permissions: ['catalog_edit'], warehouseIds: [],
    });
    const customerProduct = await createProduct(harness, { baseUnit, gtin: `0${GTIN_ONE}`, sku: 'OWN-SKU' },
      callAs(editorId, SeedOrganizationId.CUSTOMER_1));
    const countBefore = harness.state.read.listBy('products', 'tenantId', SeedOrganizationId.CUSTOMER_1).length;
    if (baseUnit === BaseUnit.PIECE) {
      await harness.deal.createDealDraft(request, CUSTOMER_CALL);
      expect(harness.state.read.list('productLinks')[0]).toMatchObject({ customerProductId: customerProduct.id, isCreatedFromDeal: false });
    }
    else {
      expect((await captureFailure(harness.deal.createDealDraft(request, CUSTOMER_CALL))).violations[0]?.ruleId)
        .toBe('deal.product.unit_mismatch');
      expect(harness.state.read.list('productLinks')).toHaveLength(0);
    }
    expect(harness.state.read.listBy('products', 'tenantId', SeedOrganizationId.CUSTOMER_1)).toHaveLength(countBefore);
  });

  it('does not allow an organization with both profiles to trade with itself', async () => {
    const { harness, request } = await createDealFixture();
    await harness.runtime.command((transaction) => {
      const organization = create(OrganizationSchema, transaction.get('organizations', SeedOrganizationId.CUSTOMER_1));
      organization.profiles.push(create(OrganizationProfileSchema, { kind: ProfileKind.SUPPLIER, verificationLevel: 3 }));
      transaction.put('organizations', organization);
    });
    const failure = await captureFailure(harness.deal.createDealDraft({
      ...request, supplierOrganizationId: SeedOrganizationId.CUSTOMER_1,
    }, CUSTOMER_CALL));
    expect(failure.violations[0]?.ruleId).toBe('deal.same_organization');
  });
});
