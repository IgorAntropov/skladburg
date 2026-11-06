import { create } from '@bufbuild/protobuf';
import {
  MembershipSchema,
  RoleSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  AvailabilityStatus,
  ListingSchema,
  ProductSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DealStatus,
  DraftDealLineSchema,
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
import {
  createShowcaseListing,
  CUSTOMER_CALL,
} from '../catalog/showcase/testing/showcaseFixtures';
import {
  buildAvailability,
  buildRub,
  captureFailure,
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

const limitedCustomer = async (harness: Awaited<ReturnType<typeof createDealFixture>>['harness'], limit: bigint): Promise<string> => {
  const userId = await addTestMember(harness,
    { organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['deal_approve'],
      warehouseIds: [] });
  await harness.runtime.command((transaction) => {
    const membership = transaction.listBy('memberships', 'userId', userId)[0];
    if (membership === undefined) {
      throw new Error('Missing member');
    }
    transaction.put('memberships', create(MembershipSchema, {
      ...membership,
      roleAssignments: membership.roleAssignments.map(assignment => ({ ...assignment, amountLimit: buildRub(limit) })),
    }));
  });
  return userId;
};

describe('deal business limits', () => {
  it.each([89_999n, 90_000n])('enforces the exact server approval boundary %s', async (limit) => {
    const { harness, request } = await createDealFixture();
    await harness.deal.createDealDraft(request, CUSTOMER_CALL);
    const user = await limitedCustomer(harness, limit);
    const call = harness.deal.submitDeal({ dealId: request.dealId,
      expectedVersion: 1,
      goodsTotal: buildRub(90_000n),
      idempotencyKey: nextUuid() },
    callAs(user,
      SeedOrganizationId.CUSTOMER_1));
    if (limit < 90_000n) {
      expect((await captureFailure(call)).code).toBe(ErrorCode.LIMIT_EXCEEDED);
    }
    else {
      expect((await call).deal?.status).toBe(DealStatus.SUBMITTED);
    }
  });

  it('checks the real amount when a caller understates goods_total', async () => {
    const { harness, request } = await createDealFixture();
    await harness.deal.createDealDraft(request, CUSTOMER_CALL);
    const user = await limitedCustomer(harness, 10n);
    const failure = await captureFailure(harness.deal.submitDeal({
      dealId: request.dealId, expectedVersion: 1, goodsTotal: buildRub(1n), idempotencyKey: nextUuid(),
    }, callAs(user, SeedOrganizationId.CUSTOMER_1)));
    expect(failure.code).toBe(ErrorCode.LIMIT_EXCEEDED);
    expect(harness.state.read.get('deals', request.dealId)?.status).toBe(DealStatus.DRAFT);
  });

  it('checks the offered total on acceptance and blocks currency substitution', async () => {
    const { harness, request } = await createDealFixture();
    const pending = await counterSubmittedDeal(harness, await createSubmittedDeal(harness, request));
    const user = await limitedCustomer(harness, 100_000n);
    expect((await captureFailure(harness.deal.acceptCounterOffer({
      dealId: pending.id, expectedVersion: pending.version, goodsTotal: buildRub(1n), idempotencyKey: nextUuid(),
    }, callAs(user, SeedOrganizationId.CUSTOMER_1)))).code).toBe(ErrorCode.LIMIT_EXCEEDED);
    expect((await captureFailure(harness.deal.acceptCounterOffer({
      dealId: pending.id,
      expectedVersion: pending.version,
      goodsTotal: { amountMinor: 127_500n,
        currencyCode: 'USD' },
      idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL))).violations[0]?.ruleId).toBe('deal.goods_total.mismatch');
  });

  it('honors permission revocation between commands', async () => {
    const { harness, request } = await createDealFixture();
    await harness.deal.createDealDraft(request, CUSTOMER_CALL);
    const user = await limitedCustomer(harness, 100_000n);
    await harness.runtime.command((transaction) => {
      const membership = transaction.listBy('memberships', 'userId', user)[0];
      const role = transaction.get('roles', membership?.roleAssignments[0]?.roleId ?? '');
      if (role !== undefined) {
        transaction.put('roles', create(RoleSchema, { ...role, permissions: [] }));
      }
    });
    expect((await captureFailure(harness.deal.submitDeal({ dealId: request.dealId,
      expectedVersion: 1,
      goodsTotal: buildRub(90_000n),
      idempotencyKey: nextUuid() },
    callAs(user,
      SeedOrganizationId.CUSTOMER_1)))).code)
      .toBe(ErrorCode.PERMISSION_DENIED);
  });

  it.each([
    { quantity: 5n, rule: 'catalog.quantity_below_minimum' },
    { quantity: 11n, rule: 'catalog.quantity_not_multiple_of_step' },
    { quantity: 105n, rule: 'deal.quantity.unavailable' },
    { quantity: 10_000_000_005n, rule: 'catalog.quantity_above_limit' },
  ])('rejects invalid quantity $quantity', async ({ quantity, rule }) => {
    const { harness, request } = await createDealFixture();
    const failure = await captureFailure(harness.deal.createDealDraft({ ...request,
      lines: request.lines.map(line => ({ ...line,
        quantity })) },
    CUSTOMER_CALL));
    expect(failure.violations.map(violation => violation.ruleId)).toContain(rule);
    expect(harness.state.read.list('deals')).toHaveLength(0);
    expect(harness.state.read.list('productLinks')).toHaveLength(0);
  });

  it('requires every line at the chosen warehouse rather than the aggregate city stock', async () => {
    const { harness, request } = await createDealFixture({ listing: { availability: [
      buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1, 5n),
      buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_2, 5n),
    ] } });
    const submitted = await createSubmittedDeal(harness, request);
    const failure = await captureFailure(harness.deal.confirmDeal({
      dealId: submitted.id,
      expectedVersion: submitted.version,
      goodsTotal: submitted.goodsTotal,
      idempotencyKey: nextUuid(),
      shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
    }, SUPPLIER_1_CALL));
    expect(failure.violations[0]?.ruleId).toBe('deal.quantity.unavailable');
  });

  it.each([
    { desiredDate: { day: 31, month: 2, year: 2027 }, rule: 'calendar_date.exists' },
    { desiredDate: { day: 1, month: 1, year: 2026 }, rule: 'deal.date.invalid' },
    { desiredDate: { day: 1, month: 1, year: 2028 }, rule: 'deal.date.invalid' },
  ])('rejects invalid desired date $desiredDate', async ({ desiredDate, rule }) => {
    const { harness, request } = await createDealFixture();
    expect((await captureFailure(harness.deal.createDealDraft({ ...request,
      desiredDate: create(CalendarDateSchema,
        desiredDate) },
    CUSTOMER_CALL))).violations[0]?.ruleId).toBe(rule);
  });

  it('checks a discount prohibition again when an offer is accepted', async () => {
    const { harness, request } = await createDealFixture();
    const pending = await counterSubmittedDeal(harness, await createSubmittedDeal(harness, request));
    await harness.runtime.command((transaction) => {
      const listing = transaction.get('listings', request.lines[0]?.listingId ?? '');
      const product = transaction.get('products', listing?.productId ?? '');
      if (product !== undefined) {
        transaction.put('products', create(ProductSchema, { ...product, isDiscountForbidden: true }));
      }
    });
    expect((await captureFailure(harness.deal.acceptCounterOffer({ dealId: pending.id, expectedVersion: pending.version,
      goodsTotal: pending.counterOffer?.goodsTotal,
      idempotencyKey: nextUuid() },
    CUSTOMER_CALL))).violations[0]?.ruleId).toBe('deal.price.discount_forbidden');
  });

  it('does not change stock while it creates and submits an on-order deal', async () => {
    const { harness,
      request } = await createDealFixture({ listing: { availability: [buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
      0n,
      AvailabilityStatus.ON_ORDER)] } });
    const before = create(ListingSchema, harness.state.read.get('listings', request.lines[0]?.listingId ?? ''));
    await createSubmittedDeal(harness, request);
    expect(harness.state.read.get('listings', before.id)).toEqual(before);
  });
});

describe('deal aggregate overflow rejects the complete draft transaction', () => {
  it('does not leave a deal, contract or product link when multiple valid lines overflow total', async () => {
    const options = {
      listing: { availability: [buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1, 0n, AvailabilityStatus.ON_ORDER)] },
      price: { tiers: [{ minQuantity: 10n, price: buildRub(500_000_000n) }] },
    };
    const { harness, request } = await createDealFixture(options);
    const { listing } = await createShowcaseListing(harness, options);
    const beforeProducts = harness.state.read.list('products').length;
    const failure = await captureFailure(harness.deal.createDealDraft({
      ...request,
      lines: [...request.lines.map(line => ({ ...line, quantity: 10_000_000_000n })), create(DraftDealLineSchema, {
        listingId: listing.id, quantity: 10_000_000_000n,
      })],
    }, CUSTOMER_CALL));
    expect(failure.violations[0]?.ruleId).toBe('catalog.amount_above_limit');
    expect(harness.state.read.list('deals')).toHaveLength(0);
    expect(harness.state.read.list('supplyContracts')).toHaveLength(0);
    expect(harness.state.read.list('productLinks')).toHaveLength(0);
    expect(harness.state.read.list('products')).toHaveLength(beforeProducts);
  });
});
