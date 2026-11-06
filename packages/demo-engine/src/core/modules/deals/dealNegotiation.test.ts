import { create } from '@bufbuild/protobuf';
import {
  BaseUnit,
  ProductSchema,
  SaveProductRequestSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  CreateDealDraftRequestSchema,
  DealStatus,
  UpdateDealDraftRequestSchema,
} from '@skladburg/contracts/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/index';
import { CUSTOMER_CALL } from '../catalog/showcase/testing/showcaseFixtures';
import {
  buildRub,
  captureFailure,
  nextUuid,
  SUPPLIER_1_CALL,
  SUPPLIER_2_CALL,
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

describe('deal negotiation invariants', () => {
  it('accepts one counter offer atomically and leaves the original unchanged while pending', async () => {
    const { harness, request } = await createDealFixture();
    const submitted = await createSubmittedDeal(harness, request);
    const pending = await counterSubmittedDeal(harness, submitted);
    expect(pending.lines[0]?.quantity).toBe(10n);
    expect(pending.goodsTotal?.amountMinor).toBe(90_000n);
    expect(pending.counterOffer?.goodsTotal?.amountMinor).toBe(127_500n);
    const accepted = await harness.deal.acceptCounterOffer({
      dealId: pending.id, expectedVersion: pending.version,
      goodsTotal: pending.counterOffer?.goodsTotal, idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL);
    expect(accepted.deal?.status).toBe(DealStatus.AGREED);
    expect(accepted.deal?.lines[0]?.quantity).toBe(15n);
    expect(accepted.deal?.goodsTotal?.amountMinor).toBe(127_500n);
    expect(accepted.deal?.shipFromWarehouseId).toBe(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1);
    expect(accepted.deal?.counterOffer).toBeUndefined();
    expect(accepted.deal?.transitions.find(transition => transition.to === DealStatus.COUNTER_OFFERED)?.actorRoleName).toBe('');
    const supplier = await harness.deal.getDeal({ dealId: pending.id }, SUPPLIER_1_CALL);
    expect(supplier.deal?.transitions.find(transition => transition.to === DealStatus.SUBMITTED)?.actorRoleName).toBe('');
    expect(supplier.deal?.transitions.find(transition => transition.to === DealStatus.COUNTER_OFFERED)?.actorRoleName).not.toBe('');
  });

  it('rejects an offer terminally and requires a current version before comparing totals', async () => {
    const { harness, request } = await createDealFixture();
    const pending = await counterSubmittedDeal(harness, await createSubmittedDeal(harness, request));
    const stale = await captureFailure(harness.deal.acceptCounterOffer({
      dealId: pending.id, expectedVersion: 2, goodsTotal: buildRub(1n), idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL));
    expect(stale.code).toBe(ErrorCode.VERSION_CONFLICT);
    const rejected = await harness.deal.rejectCounterOffer({
      dealId: pending.id, expectedVersion: pending.version, idempotencyKey: nextUuid(), reason: 'Не подходит',
    }, CUSTOMER_CALL);
    expect(rejected.deal?.status).toBe(DealStatus.REJECTED);
    expect((await captureFailure(harness.deal.cancelDeal({
      dealId: pending.id, expectedVersion: rejected.deal?.version, idempotencyKey: nextUuid(), reason: 'Отмена',
    }, CUSTOMER_CALL))).code).toBe(ErrorCode.INVALID_TRANSITION);
  });

  it('rejects the other side and a third organization even with the same permission', async () => {
    const { harness, request } = await createDealFixture();
    const deal = await createSubmittedDeal(harness, request);
    const command = { dealId: deal.id, expectedVersion: deal.version, idempotencyKey: nextUuid(), reason: 'Нет' };
    expect((await captureFailure(harness.deal.rejectDeal(command, CUSTOMER_CALL))).code).toBe(ErrorCode.PERMISSION_DENIED);
    expect((await captureFailure(harness.deal.rejectDeal(command, SUPPLIER_2_CALL))).code).toBe(ErrorCode.NOT_FOUND);
    const viewer = await addTestMember(harness,
      { organizationId: SeedOrganizationId.SUPPLIER_1,
        permissions: ['deal_view'],
        warehouseIds: [] });
    expect((await captureFailure(harness.deal.rejectDeal(command, callAs(viewer, SeedOrganizationId.SUPPLIER_1)))).code)
      .toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('makes create and updates idempotent without duplicating pair contracts and products', async () => {
    const { harness, request } = await createDealFixture();
    const first = await harness.deal.createDealDraft(request, CUSTOMER_CALL);
    expect(await harness.deal.createDealDraft(request, CUSTOMER_CALL)).toEqual(first);
    const next = create(CreateDealDraftRequestSchema, { ...request, dealId: nextUuid(), idempotencyKey: nextUuid() });
    await harness.deal.createDealDraft(next, CUSTOMER_CALL);
    expect(harness.state.read.list('supplyContracts')).toHaveLength(1);
    expect(harness.state.read.list('productLinks')).toHaveLength(1);
    const updated = create(UpdateDealDraftRequestSchema,
      { dealId: request.dealId,
        desiredDate: request.desiredDate,
        expectedVersion: 1,
        idempotencyKey: nextUuid(),
        lines: request.lines.map(line => ({ ...line,
          quantity: 15n })),
        shipFromCityId: request.shipFromCityId,
        shipToWarehouseId: request.shipToWarehouseId });
    const result = await harness.deal.updateDealDraft(updated, CUSTOMER_CALL);
    expect(await harness.deal.updateDealDraft(updated, CUSTOMER_CALL)).toEqual(result);
    expect((await captureFailure(harness.deal.updateDealDraft({ ...updated,
      desiredDate: create(CalendarDateSchema,
        { day: 21,
          month: 10,
          year: 2026 }) },
    CUSTOMER_CALL))).code)
      .toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    expect(result.deal?.lines[0]?.id).toBe(first.deal?.lines[0]?.id);
  });

  it('rejects a reused product link after the customer changes the unit', async () => {
    const { harness, request } = await createDealFixture();
    await harness.deal.createDealDraft(request, CUSTOMER_CALL);
    const link = harness.state.read.list('productLinks')[0];
    const product = create(ProductSchema, harness.state.read.get('products', link?.customerProductId ?? ''));
    const editorId = await addTestMember(harness,
      { organizationId: SeedOrganizationId.CUSTOMER_1,
        permissions: ['catalog_edit'],
        warehouseIds: [] });
    await harness.catalog.saveProduct(create(SaveProductRequestSchema, {
      baseUnit: BaseUnit.GRAM, expectedVersion: product.version, gtin: product.gtin, idempotencyKey: nextUuid(),
      markingMode: product.markingMode, name: product.name, packagings: product.packagings, productId: product.id,
      shelfLifeDays: product.shelfLifeDays, sku: product.sku, vatRate: product.vatRate,
    }), callAs(editorId, SeedOrganizationId.CUSTOMER_1));
    const response = await captureFailure(harness.deal.createDealDraft({ ...request,
      dealId: nextUuid(),
      idempotencyKey: nextUuid() },
    CUSTOMER_CALL));
    expect(response.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(response.violations[0]?.ruleId).toBe('deal.product.unit_mismatch');
    expect(harness.state.read.list('deals')).toHaveLength(1);
  });

  it('keeps only public fields in snapshots and customer products', async () => {
    const { harness,
      request } = await createDealFixture({ product: { isDiscountForbidden: true,
      minPrice: buildRub(8000n),
      sku: 'PRIVATE-SKU' } });
    const created = await harness.deal.createDealDraft(request, CUSTOMER_CALL);
    expect(created.deal?.lines[0]?.productSnapshot).not.toHaveProperty('sku');
    expect(created.deal?.lines[0]?.productSnapshot).not.toHaveProperty('minPrice');
    expect(created.deal?.lines[0]?.productSnapshot).not.toHaveProperty('isDiscountForbidden');
    const link = harness.state.read.list('productLinks')[0];
    const customerProduct = harness.state.read.get('products', link?.customerProductId ?? '');
    expect(customerProduct?.sku).not.toBe('PRIVATE-SKU');
    expect(customerProduct?.minPrice).toBeUndefined();
    expect(customerProduct?.isDiscountForbidden).toBe(false);
  });
});

describe('deal snapshots after agreement', () => {
  it('keeps agreed prices and product names after catalog changes and delivery choice', async () => {
    const { harness, request } = await createDealFixture();
    const submitted = await createSubmittedDeal(harness, request);
    const confirmed = await harness.deal.confirmDeal({
      dealId: submitted.id, expectedVersion: submitted.version, goodsTotal: submitted.goodsTotal,
      idempotencyKey: nextUuid(), shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
    }, SUPPLIER_1_CALL);
    const listingId = request.lines[0]?.listingId ?? '';
    const own = await harness.catalog.getOwnListing({ listingId }, SUPPLIER_1_CALL);
    const product = own.listing?.product;
    if (product === undefined) {
      throw new Error('Missing product');
    }
    await harness.catalog.saveProduct(create(SaveProductRequestSchema, {
      baseUnit: product.baseUnit, expectedVersion: product.version, gtin: product.gtin, idempotencyKey: nextUuid(),
      markingMode: product.markingMode, name: 'Новое имя товара', packagings: product.packagings, productId: product.id,
      shelfLifeDays: product.shelfLifeDays, sku: product.sku, vatRate: product.vatRate,
    }), SUPPLIER_1_CALL);
    const price = harness.state.read.get('listingPrices', listingId);
    await harness.catalog.saveListingPrice({
      expectedVersion: price?.version, idempotencyKey: nextUuid(), listingId,
      tiers: [{ minQuantity: 10n, price: buildRub(9900n) }],
    }, SUPPLIER_1_CALL);
    const read = await harness.deal.getDeal({ dealId: submitted.id }, CUSTOMER_CALL);
    expect(read.deal?.lines).toEqual(confirmed.deal?.lines);
    expect(read.deal?.goodsTotal).toEqual(confirmed.deal?.goodsTotal);
    const chosen = await harness.deal.chooseDelivery({
      dealId: submitted.id, deliveryMethod: DeliveryMethod.CUSTOMER, expectedVersion: confirmed.deal?.version, idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL);
    expect(chosen.deal?.lines).toEqual(confirmed.deal?.lines);
    expect(chosen.deal?.goodsTotal).toEqual(confirmed.deal?.goodsTotal);
  });

  it('allows supplier cancellation after submission and retains customer product links', async () => {
    const { harness, request } = await createDealFixture();
    const submitted = await createSubmittedDeal(harness, request);
    const cancelled = await harness.deal.cancelDeal({
      dealId: submitted.id, expectedVersion: submitted.version, idempotencyKey: nextUuid(), reason: 'Нет поставки',
    }, SUPPLIER_1_CALL);
    expect(cancelled.deal?.status).toBe(DealStatus.CANCELLED);
    expect((await harness.deal.getDeal({ dealId: submitted.id }, SUPPLIER_1_CALL)).deal?.status).toBe(DealStatus.CANCELLED);
    expect(harness.state.read.list('productLinks')).toHaveLength(1);
  });
});
