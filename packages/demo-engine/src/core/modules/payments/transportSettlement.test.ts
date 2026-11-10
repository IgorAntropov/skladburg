import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { TripRecord } from '@skladburg/contracts/logistics/v1/trip_records';
import type { TransportSettlement } from '@skladburg/contracts/payment/v1/payment';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentSchema,
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';
import {
  TripRecordSchema,
  TripStatus,
} from '@skladburg/contracts/logistics/v1/trip_records';
import {
  PaymentService,
  SafeDealPaymentRecordSchema,
  SafeDealPaymentSchema,
  TransportPaymentBreakdownSchema,
} from '@skladburg/contracts/payment/v1/payment';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../../errors/index';
import { createSeededRandom } from '../../ports/index';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/index';
import { CUSTOMER_CALL } from '../catalog/showcase/testing/showcaseFixtures';
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  MAX_DEAL_INTEGER,
  rub,
} from '../deals/dealRules';
import {
  callAs,
  createModuleHarness,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import {
  buildTransportSettlement,
  projectPayment,
  readCarrierTripPayment,
} from './transportSettlement';

const BUYER_ID = 'buyer';
const SUPPLIER_ID = 'supplier';
const CARRIER_ID = 'carrier';
const GOODS_MINOR = 1_000_000n;
const SHIPPING_MINOR = 200_000n;
const GOODS_COMMISSION_MINOR = 15_000n;
const CARRIER_COMMISSION_MINOR = 3_000n;

const dealFor = (goodsMinor: bigint): Deal => create(DealSchema, {
  customerOrganizationId: BUYER_ID,
  goodsTotal: rub(goodsMinor),
  id: 'deal',
  supplierOrganizationId: SUPPLIER_ID,
});

const tripFor = (payerOrganizationId: string, shippingMinor: bigint): TripRecord => create(TripRecordSchema, {
  dealId: 'deal',
  id: 'trip',
  transportOrder: {
    amount: rub(shippingMinor),
    carrierOrganizationId: CARRIER_ID,
    shipperOrganizationId: payerOrganizationId,
  },
});

const settle = (goodsMinor: bigint, shippingMinor: bigint, payerOrganizationId: string): TransportSettlement =>
  buildTransportSettlement(createDomainErrors(createSeededRandom(1)), dealFor(goodsMinor), tripFor(payerOrganizationId, shippingMinor));

describe('transport settlement', () => {
  it.each([
    { fundedMinor: 1_200_000n, payerOrganizationId: BUYER_ID, supplierMinor: 985_000n },
    { fundedMinor: 1_000_000n, payerOrganizationId: SUPPLIER_ID, supplierMinor: 785_000n },
  ])('funds and allocates the invoice when $payerOrganizationId pays for transport', ({
    fundedMinor, payerOrganizationId, supplierMinor,
  }) => {
    const settlement = settle(GOODS_MINOR, SHIPPING_MINOR, payerOrganizationId);
    expect(settlement).toMatchObject({
      carrierCommission: rub(CARRIER_COMMISSION_MINOR),
      carrierOrganizationId: CARRIER_ID,
      carrierPayout: rub(197_000n),
      fundedAmount: rub(fundedMinor),
      payerOrganizationId,
      shippingAmount: rub(SHIPPING_MINOR),
      supplierPayout: rub(supplierMinor),
      tripId: 'trip',
    });
    expect(supplierMinor + 197_000n + GOODS_COMMISSION_MINOR + CARRIER_COMMISSION_MINOR).toBe(fundedMinor);
  });

  it('rounds the commissions on goods and transport independently, half-up', () => {
    const settlement = settle(100n, 100n, BUYER_ID);
    expect(settlement).toMatchObject({
      carrierCommission: rub(2n),
      carrierPayout: rub(98n),
      fundedAmount: rub(200n),
      supplierPayout: rub(98n),
    });
  });

  it('accepts a supplier bid up to its revenue after commission', () => {
    expect(settle(100n, 98n, SUPPLIER_ID).supplierPayout).toEqual(rub(0n));
    expect(() => settle(100n, 99n, SUPPLIER_ID)).toThrow('validation_failed');
  });

  it('keeps the composed customer charge in int64', () => {
    expect(settle(MAX_DEAL_INTEGER - 1n, 1n, BUYER_ID).fundedAmount).toEqual(rub(MAX_DEAL_INTEGER));
    expect(() => settle(MAX_DEAL_INTEGER, 1n, BUYER_ID)).toThrow('validation_failed');
  });

  it('rejects a shipping currency other than RUB', () => {
    const trip = tripFor(BUYER_ID, 100n);
    if (trip.transportOrder?.amount === undefined) {
      throw new Error('Expected an order with a rate');
    }
    trip.transportOrder.amount.currencyCode = 'USD';
    const errors = createDomainErrors(createSeededRandom(2));

    expect(() => buildTransportSettlement(errors, dealFor(100n), trip)).toThrow(ErrorCode[ErrorCode.VALIDATION_FAILED].toLowerCase());
  });
});

describe('transport payment projection', () => {
  it('invalidates the carrier trip exactly once when funding first exposes its breakdown', async () => {
    const { events, runtime, transport } = createModuleHarness();
    const payments = createClient(PaymentService, transport);
    const logistics = createClient(LogisticsService, transport);
    const dealId = nextUuid();
    const tripId = nextUuid();
    const buyerId = SeedOrganizationId.CUSTOMER_1;
    const supplierId = SeedOrganizationId.SUPPLIER_1;
    const carrierId = SeedOrganizationId.CARRIER_1;
    const carrier = callAs(SeedUserId.ADMIN_4, carrierId);
    const goodsAmount = rub(GOODS_MINOR);
    await runtime.command((transaction) => {
      const at = timestampFromMs(transaction.worldTimeMs);
      transaction.put('deals', create(DealSchema, {
        customerOrganizationId: buyerId,
        deadlines: { paymentDueAt: at },
        deliveryMethod: DeliveryMethod.EXCHANGE,
        goodsTotal: goodsAmount,
        id: dealId,
        status: DealStatus.AWAITING_PAYMENT,
        supplierOrganizationId: supplierId,
      }));
      transaction.put('documents', create(DocumentSchema, {
        content: { terms: { case: 'invoice', value: { deliveryTotal: rub(0n), goodsTotal: goodsAmount, total: goodsAmount } } },
        dealId,
        id: nextUuid(),
        status: DocumentStatus.SIGNED,
        type: DocumentType.INVOICE,
      }));
      transaction.put('trips', create(TripRecordSchema, {
        customerOrganizationId: buyerId,
        dealId,
        id: tripId,
        status: TripStatus.CONFIRMED,
        supplierOrganizationId: supplierId,
        transportOrder: { amount: rub(SHIPPING_MINOR), carrierOrganizationId: carrierId, confirmedAt: at, shipperOrganizationId: buyerId },
      }));
    });

    expect((await logistics.getTrip({ tripId }, carrier)).trip?.carrierPayment).toBeUndefined();
    const fund = { amount: rub(GOODS_MINOR + SHIPPING_MINOR), dealId, expectedVersion: 1, idempotencyKey: nextUuid() };
    const funded = await payments.fundDeal(fund, CUSTOMER_CALL);
    expect(await payments.fundDeal(fund, CUSTOMER_CALL)).toEqual(funded);
    expect(events.filter(event => event.payload.case === 'transportRequestChanged').map(event => event.channel))
      .toEqual([organizationChannel(carrierId)]);
    expect((await logistics.getTrip({ tripId }, carrier)).trip?.carrierPayment).toMatchObject({
      commissionAmount: rub(CARRIER_COMMISSION_MINOR),
      shippingAmount: rub(SHIPPING_MINOR),
    });
  });

  it.each([BUYER_ID, SUPPLIER_ID])('keeps the shipping rate visible only to the payer %s', (payerOrganizationId) => {
    const transportSettlement = settle(GOODS_MINOR, SHIPPING_MINOR, payerOrganizationId);
    const isBuyerPayer = payerOrganizationId === BUYER_ID;
    const nonPayer = isBuyerPayer ? SUPPLIER_ID : BUYER_ID;
    const deal = dealFor(GOODS_MINOR);
    const payment = create(SafeDealPaymentSchema, {
      commissionAmount: rub(GOODS_COMMISSION_MINOR),
      deliveryAmount: rub(isBuyerPayer ? SHIPPING_MINOR : 0n),
      fundedAmount: transportSettlement.fundedAmount,
      goodsAmount: rub(GOODS_MINOR),
      payouts: [
        { amount: transportSettlement.supplierPayout, organizationId: SUPPLIER_ID },
        { amount: transportSettlement.carrierPayout, organizationId: CARRIER_ID },
      ],
    });
    const record = create(SafeDealPaymentRecordSchema, { payment, transportSettlement });
    const payerView = projectPayment(record, deal, payerOrganizationId);
    const nonPayerView = projectPayment(record, deal, nonPayer);

    expect(payerView?.transport).toMatchObject({
      carrierPayout: { amount: transportSettlement.carrierPayout, organizationId: CARRIER_ID },
      commissionAmount: rub(CARRIER_COMMISSION_MINOR),
      shippingAmount: rub(SHIPPING_MINOR),
    });
    expect(nonPayerView?.transport).toBeUndefined();
    expect(nonPayerView?.fundedAmount).toEqual(isBuyerPayer ? undefined : rub(GOODS_MINOR));
    expect(nonPayerView?.deliveryAmount).toEqual(isBuyerPayer ? undefined : rub(0n));
    expect(nonPayerView?.commissionAmount).toEqual(rub(GOODS_COMMISSION_MINOR));
    expect(nonPayerView?.payouts.map(payout => payout.organizationId)).toEqual(isBuyerPayer ? [SUPPLIER_ID] : []);
    expect(record.payment?.payouts).toHaveLength(2);
    expect(projectPayment(record, deal, CARRIER_ID)).toBeUndefined();
  });

  it('exposes only the carrier breakdown for the matching trip and beneficiary', async () => {
    const { runtime } = createTestRuntime();
    const transportSettlement = settle(GOODS_MINOR, SHIPPING_MINOR, BUYER_ID);
    const payment = create(SafeDealPaymentSchema, {
      bankReference: 'demo-bank-reference',
      goodsAmount: rub(GOODS_MINOR),
      id: 'deal',
      payouts: [
        { amount: transportSettlement.supplierPayout, organizationId: SUPPLIER_ID },
        { amount: transportSettlement.carrierPayout, organizationId: CARRIER_ID },
      ],
    });
    const trip = tripFor(BUYER_ID, SHIPPING_MINOR);
    const carrierPayout = payment.payouts.find(payout => payout.organizationId === CARRIER_ID);
    await runtime.command((transaction) => {
      transaction.put('payments', create(SafeDealPaymentRecordSchema, {
        id: 'deal',
        payment,
        transportSettlement,
      }));
    });

    expect(readCarrierTripPayment(runtime.read, trip)).toEqual(create(TransportPaymentBreakdownSchema, {
      carrierPayout,
      commissionAmount: rub(CARRIER_COMMISSION_MINOR),
      commissionRateBasisPoints: 150,
      shippingAmount: rub(SHIPPING_MINOR),
    }));
    expect(readCarrierTripPayment(runtime.read, { ...trip, id: 'other-trip' })).toBeUndefined();
    expect(readCarrierTripPayment(runtime.read, { ...trip, transportOrder: undefined })).toBeUndefined();
  });
});
