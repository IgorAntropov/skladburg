import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { MembershipSchema } from '@skladburg/contracts/access/v1/access';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  DealSchema,
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentService,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  DealNotice,
  NotificationService,
} from '@skladburg/contracts/notification/v1/notification';
import {
  PaymentService,
  type SafeDealPayment,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getStartOfDayInstant } from '../../calendar/zonedTime';
import {
  createEngineTransport,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
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
} from '../catalog/testing/catalogFixtures';
import { createDealFixture } from '../deals/testing/dealFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';

const createPayableDeal = async (
  day = 20,
  month = 10,
  options: {
    configure?: (harness: Awaited<ReturnType<typeof createDealFixture>>['harness']) => Promise<void>;
    unitPrice?: bigint;
    year?: number;
  } = {},
): Promise<{
  dealId: string;
  deals: ReturnType<typeof createClient<typeof DealService>>;
  payments: ReturnType<typeof createClient<typeof PaymentService>>;
  testEngine: Awaited<ReturnType<typeof createTestEngine>>;
  total: bigint;
}> => {
  const { unitPrice } = options;
  const { harness, request } = await createDealFixture(unitPrice === undefined
    ? {}
    : { price: { tiers: [{ minQuantity: 10n, price: buildRub(unitPrice) }] } });
  await options.configure?.(harness);
  const testEngine = await createTestEngine({ storage: createSpyStorage(await harness.storage.load()) });
  const transport = createEngineTransport(testEngine.engine, true);
  const deals = createClient(DealService, transport);
  const payments = createClient(PaymentService, transport);
  const documents = createClient(DocumentService, transport);
  const { dealId } = request;
  request.desiredDate = create(CalendarDateSchema, { day, month, year: options.year ?? 2026 });
  const created = await deals.createDealDraft(request, CUSTOMER_CALL);
  const submitted = await deals.submitDeal({
    dealId, expectedVersion: 1, goodsTotal: created.deal?.goodsTotal, idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
  await deals.confirmDeal({
    dealId,
    expectedVersion: 2,
    goodsTotal: submitted.deal?.goodsTotal,
    idempotencyKey: nextUuid(),
    shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
  }, SUPPLIER_1_CALL);
  await deals.chooseDelivery({
    dealId, deliveryMethod: DeliveryMethod.CUSTOMER, expectedVersion: 3, idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
  for (const document of (await documents.listDealDocuments({ dealId }, SUPPLIER_1_CALL)).documents) {
    const sign = document.type === DocumentType.SUPPLY_CONTRACT ? documents.signSupplyContract : documents.signDocument;
    await sign({ dealId, documentId: document.id, expectedVersion: 1, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);
    await sign({ dealId, documentId: document.id, expectedVersion: 2, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
  }
  return { dealId, deals, payments, testEngine, total: created.deal?.goodsTotal?.amountMinor ?? 0n };
};

const advanceWorld = async (testEngine: Awaited<ReturnType<typeof createTestEngine>>, deltaMs: number): Promise<void> => {
  testEngine.realTime.advance(Math.ceil(deltaMs / testEngine.engine.getClockSnapshot().timeScale));
  await testEngine.engine.tick();
};

describe('safe deal through Connect', () => {
  it('blocks the signed invoice exactly once and settles only after acceptance', async () => {
    let outsiderId = '';
    const { dealId, deals, payments, testEngine, total } = await createPayableDeal(20, 10, {
      configure: async (harness) => {
        outsiderId = await addTestMember(harness, {
          organizationId: SeedOrganizationId.SUPPLIER_2, permissions: ['payment_view'], warehouseIds: [],
        });
      },
      unitPrice: 9_010n,
    });
    const readPayment = async (): Promise<SafeDealPayment | undefined> => {
      const { payment } = await payments.getDealPayment({ dealId }, CUSTOMER_CALL);
      expect((await payments.getDealPayment({ dealId }, SUPPLIER_1_CALL)).payment).toEqual(payment);
      return payment;
    };
    expect(total).toBe(90_100n);
    expect(await readPayment()).toMatchObject({ status: SafeDealPaymentStatus.INVOICED, version: 1 });
    const outsider = callAs(outsiderId, SeedOrganizationId.SUPPLIER_2);
    expect((await captureFailure(payments.getDealPayment({ dealId }, outsider))).code).toBe(ErrorCode.NOT_FOUND);
    const fund = { amount: buildRub(total), dealId, expectedVersion: 1, idempotencyKey: nextUuid() };
    const stale = await captureFailure(payments.fundDeal({ ...fund, expectedVersion: 0, idempotencyKey: nextUuid() }, CUSTOMER_CALL));
    expect(stale.code).toBe(ErrorCode.VERSION_CONFLICT);
    const mismatched = await captureFailure(payments.fundDeal({ ...fund, amount: buildRub(total - 1n) }, CUSTOMER_CALL));
    expect(mismatched.code).toBe(ErrorCode.VALIDATION_FAILED);
    const funded = await payments.fundDeal(fund, CUSTOMER_CALL);
    expect(funded.payment?.status).toBe(SafeDealPaymentStatus.AWAITING_FUNDS);
    expect(await payments.fundDeal(fund, CUSTOMER_CALL)).toEqual(funded);
    expect(await readPayment()).toEqual(funded.payment);

    await advanceWorld(testEngine, 5 * 60_000);
    const paid = (await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal;
    expect(paid?.status).toBe(DealStatus.PAID);
    expect((await readPayment())?.status).toBe(SafeDealPaymentStatus.BLOCKED);
    const early = await captureFailure(deals.acceptDeal({
      dealId, expectedVersion: paid?.version ?? 0, idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL));
    expect(early.code).toBe(ErrorCode.INVALID_TRANSITION);

    const { deal: shipped } = await deals.markDealShipped({
      dealId, expectedVersion: paid?.version ?? 0, idempotencyKey: nextUuid(),
    }, SUPPLIER_1_CALL);
    expect(shipped?.status).toBe(DealStatus.SHIPPED);
    expect(shipped?.transitions.at(-1)).toMatchObject({ from: DealStatus.PAID, to: DealStatus.SHIPPED });
    expect((await readPayment())?.status).toBe(SafeDealPaymentStatus.HELD);
    const arrival = shipped?.deadlines?.arrivalDueAt;
    expect(arrival).toBeDefined();
    if (arrival === undefined) {
      throw new Error('Missing arrival deadline');
    }
    await advanceWorld(testEngine, timestampMs(arrival) - testEngine.engine.getClockSnapshot().worldTimeMs + 60_000);
    const arrived = (await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal;
    expect(arrived?.status).toBe(DealStatus.ARRIVED);
    expect((await readPayment())?.payouts).toEqual([]);

    await deals.acceptDeal({ dealId, expectedVersion: arrived?.version ?? 0, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
    expect((await readPayment())?.status).toBe(SafeDealPaymentStatus.TO_PAYOUT);
    await advanceWorld(testEngine, 3 * 60_000);
    const settled = await readPayment();
    expect(settled).toMatchObject({
      commissionAmount: { amountMinor: 1_352n },
      payouts: [{ amount: { amountMinor: 88_748n } }],
      status: SafeDealPaymentStatus.CLOSED,
    });
    expect((await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.CLOSED);
  });

  it('waits until the end of the next working day across a holiday before automatic acceptance', async () => {
    const { dealId, deals, payments, testEngine, total } = await createPayableDeal(3, 11);
    await payments.fundDeal({ amount: buildRub(total), dealId, expectedVersion: 1, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
    await advanceWorld(testEngine, 5 * 60_000);
    const paid = (await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal;
    const { deal: shipped } = await deals.markDealShipped({
      dealId, expectedVersion: paid?.version ?? 0, idempotencyKey: nextUuid(),
    }, SUPPLIER_1_CALL);
    const { arrivalDueAt, timeZone = '' } = shipped?.deadlines ?? {};
    if (arrivalDueAt === undefined) {
      throw new Error('Missing arrival deadline');
    }
    await advanceWorld(testEngine, timestampMs(arrivalDueAt) - testEngine.engine.getClockSnapshot().worldTimeMs + 60_000);
    const arrived = (await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal;
    const expectedDueAt = getStartOfDayInstant({ day: 6, month: 11, year: 2026 }, timeZone) - 1;
    const dueAt = arrived?.deadlines?.acceptanceDueAt;
    expect(dueAt === undefined ? undefined : timestampMs(dueAt)).toBe(expectedDueAt);
    expect(arrived?.deadlines?.calendarVersion).toBeTruthy();
    const failedCancel = await captureFailure(deals.cancelDeal({
      dealId, expectedVersion: arrived?.version ?? 0, idempotencyKey: nextUuid(), reason: 'Отменяем поставку',
    }, CUSTOMER_CALL));
    expect(failedCancel.code).toBe(ErrorCode.INVALID_TRANSITION);
    await advanceWorld(testEngine, expectedDueAt - testEngine.engine.getClockSnapshot().worldTimeMs - 60_000);
    expect((await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.ARRIVED);
    const notifications = createClient(NotificationService, createEngineTransport(testEngine.engine, true));
    const { notifications: messages } = await notifications.listNotifications({}, CUSTOMER_CALL);
    expect(messages.filter(message => message.params.case === 'dealUpdate'
      && message.params.value.dealId === dealId
      && message.params.value.notice === DealNotice.ACCEPTANCE_DUE)).toHaveLength(1);
    await advanceWorld(testEngine, 120_000);
    expect((await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal?.transitions.map(transition => transition.to))
      .toContain(DealStatus.ACCEPTED);
    await advanceWorld(testEngine, 180_000);
    expect((await payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment?.status).toBe(SafeDealPaymentStatus.CLOSED);
  });

  it('keeps the invoice unfunded if arrival is too late to schedule automatic acceptance', async () => {
    const { dealId, payments, total } = await createPayableDeal(31, 12, { year: 2027 });
    const funding = payments.fundDeal({
      amount: buildRub(total), dealId, expectedVersion: 1, idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL);
    expect((await captureFailure(funding)).code).toBe(ErrorCode.UNAVAILABLE);
    expect((await payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment?.status).toBe(SafeDealPaymentStatus.INVOICED);
  });

  it('allows a refund if the calendar horizon passes before a funded deal is shipped', async () => {
    const { dealId, deals, payments, testEngine, total } = await createPayableDeal();
    await payments.fundDeal({ amount: buildRub(total), dealId, expectedVersion: 1, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
    await advanceWorld(testEngine, 5 * 60_000);
    const paid = (await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal;
    const horizon = getStartOfDayInstant({ day: 1, month: 1, year: 2028 }, 'UTC');
    testEngine.realTime.advance(horizon - testEngine.engine.getClockSnapshot().worldTimeMs);
    const command = { dealId, expectedVersion: paid?.version ?? 0, idempotencyKey: nextUuid() };
    expect((await captureFailure(deals.markDealShipped(command, SUPPLIER_1_CALL))).code).toBe(ErrorCode.UNAVAILABLE);
    expect((await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.PAID);
    await deals.cancelDeal({ ...command, idempotencyKey: nextUuid(), reason: 'Отменяем поставку' }, CUSTOMER_CALL);
    expect((await payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment?.status).toBe(SafeDealPaymentStatus.REFUNDED);
  });

  it.each([
    { amount: 1n, currencyCode: 'RUB', isAllowed: false, limit: 89_999n },
    { amount: 90_000n, currencyCode: 'RUB', isAllowed: true, limit: 90_000n },
    { amount: 90_000n, currencyCode: 'USD', isAllowed: false, limit: 90_000n },
  ])('enforces the signed amount against $limit $currencyCode when the request asks for $amount', async ({
    amount, currencyCode, isAllowed, limit,
  }) => {
    let userId = '';
    const { dealId, payments, total } = await createPayableDeal(20, 10, { configure: async (harness) => {
      userId = await addTestMember(harness, {
        organizationId: SeedOrganizationId.CUSTOMER_1, permissions: ['payment_fund'], warehouseIds: [],
      });
      await harness.runtime.command((transaction) => {
        const member = transaction.listBy('memberships', 'userId', userId)[0];
        if (member === undefined) {
          throw new Error('Missing payment member');
        }
        transaction.put('memberships', create(MembershipSchema, {
          ...member,
          roleAssignments: member.roleAssignments.map(role => ({
            ...role,
            amountLimit: create(MoneySchema, { amountMinor: limit, currencyCode }),
          })),
        }));
      });
    } });
    expect(total).toBe(90_000n);
    const funding = payments.fundDeal({
      amount: buildRub(amount), dealId, expectedVersion: 1, idempotencyKey: nextUuid(),
    }, callAs(userId, SeedOrganizationId.CUSTOMER_1));
    if (isAllowed) {
      expect((await funding).payment?.status).toBe(SafeDealPaymentStatus.AWAITING_FUNDS);
    }
    else {
      expect(readErrorDetail(await captureError(funding))).toMatchObject({
        code: ErrorCode.LIMIT_EXCEEDED,
        params: {
          case: 'limitExceeded',
          value: { limit: { amountMinor: limit, currencyCode }, permission: 'payment_fund', requested: buildRub(total) },
        },
      });
      expect((await payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment?.status).toBe(SafeDealPaymentStatus.INVOICED);
    }
  });

  it('recovers the payment deadline of an earlier signed deal from its original signing time', async () => {
    const { dealId, deals, testEngine } = await createPayableDeal();
    const original = (await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal;
    expect(original?.deadlines?.paymentDueAt).toBeDefined();
    const snapshot = await testEngine.storage.load();
    const bytes = snapshot?.collections.deals.get(dealId);
    if (snapshot === undefined || !(bytes instanceof Uint8Array)) {
      throw new Error('Missing persisted deal');
    }
    const legacyDeal = fromBinary(DealSchema, bytes);
    if (legacyDeal.deadlines !== undefined) {
      legacyDeal.deadlines.paymentDueAt = undefined;
    }
    const restored = await createTestEngine({ storage: createSpyStorage({
      ...snapshot,
      collections: { ...snapshot.collections, deals: new Map([[dealId, toBinary(DealSchema, legacyDeal)]]) },
      meta: { ...snapshot.meta, worldTimeMs: snapshot.meta.worldTimeMs + 86_400_000 },
    }) });
    const restoredDeals = createClient(DealService, createEngineTransport(restored.engine, true));
    const { deal } = await restoredDeals.getDeal({ dealId }, CUSTOMER_CALL);
    expect(deal?.deadlines?.paymentDueAt).toEqual(original?.deadlines?.paymentDueAt);
    expect(deal?.version).toBe(original?.version);
  });

  it('cancels pending funding atomically and never blocks the money on a later tick', async () => {
    const { dealId, deals, payments, testEngine, total } = await createPayableDeal();
    const fund = { amount: buildRub(total), dealId, expectedVersion: 1, idempotencyKey: nextUuid() };
    const results = await Promise.allSettled([
      payments.fundDeal(fund, CUSTOMER_CALL),
      payments.fundDeal({ ...fund, idempotencyKey: nextUuid() }, CUSTOMER_CALL),
    ]);
    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const awaiting = (await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal;
    await deals.cancelDeal({
      dealId, expectedVersion: awaiting?.version ?? 0, idempotencyKey: nextUuid(), reason: 'Отменяем поставку',
    }, SUPPLIER_1_CALL);
    await advanceWorld(testEngine, 300_000);
    const { payment } = await payments.getDealPayment({ dealId }, CUSTOMER_CALL);
    expect(payment?.status).toBe(SafeDealPaymentStatus.REFUNDED);
    expect(payment?.transitions.map(transition => transition.to)).toEqual([
      SafeDealPaymentStatus.AWAITING_FUNDS, SafeDealPaymentStatus.REFUNDED,
    ]);
    expect((await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.CANCELLED);
  });

  it('restores blocked funds and permits only the customer to cancel and refund them', async () => {
    const { dealId, payments, testEngine, total } = await createPayableDeal();
    await payments.fundDeal({ amount: buildRub(total), dealId, expectedVersion: 1, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
    const restored = await createTestEngine({ storage: testEngine.storage });
    await advanceWorld(restored, 5 * 60_000);
    const transport = createEngineTransport(restored.engine, true);
    const deals = createClient(DealService, transport);
    const restoredPayments = createClient(PaymentService, transport);
    const paid = (await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal;
    expect(paid?.status).toBe(DealStatus.PAID);
    const cancel = { dealId, expectedVersion: paid?.version ?? 0, idempotencyKey: nextUuid(), reason: 'Отменяем поставку' };
    expect((await captureFailure(deals.cancelDeal(cancel, SUPPLIER_1_CALL))).code).toBe(ErrorCode.PERMISSION_DENIED);
    const cancelled = await deals.cancelDeal(cancel, CUSTOMER_CALL);
    expect(cancelled.deal?.status).toBe(DealStatus.CANCELLED);
    expect(await deals.cancelDeal(cancel, CUSTOMER_CALL)).toEqual(cancelled);
    await advanceWorld(restored, 10 * 60_000);
    expect((await restoredPayments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment).toMatchObject({
      payouts: [],
      status: SafeDealPaymentStatus.REFUNDED,
    });
  });
});
