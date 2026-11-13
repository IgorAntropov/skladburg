import { create } from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  TripRecordSchema,
  TripStatus,
} from '@skladburg/contracts/logistics/v1/trip_records';
import {
  PayoutStatus,
  SafeDealPaymentRecordSchema,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createEngineState } from '../../state/index';
import { rub } from '../deals/dealRules';
import { createTestRuntime } from '../testing/testRuntime';
import { createInvoicedPayment } from './invoicedPayment';
import { loadExchangePayments } from './loadExchangePayments';
import { schedulePartialReceiptPayout } from './partialReceiptSettlement';
import { runPaymentTask } from './paymentLifecycle';
import {
  buildTransportSettlement,
  projectPayment,
  readCarrierTripPayment,
} from './transportSettlement';

const BUYER_ID = 'buyer';
const SUPPLIER_ID = 'supplier';
const CARRIER_ID = 'carrier';
const GOODS_MINOR = 1_000n;
const SHIPPING_MINOR = 200n;

describe('partially accepted receipt payment', () => {
  it.each([
    {
      acceptedMinor: 500n, commissionMinor: 8n, deliveryMethod: DeliveryMethod.CUSTOMER,
      heldTransportMinor: 0n, payer: BUYER_ID, payoutMinor: 492n,
    },
    {
      acceptedMinor: 500n, commissionMinor: 8n, deliveryMethod: DeliveryMethod.SUPPLIER,
      heldTransportMinor: 200n, payer: BUYER_ID, payoutMinor: 492n,
    },
    {
      acceptedMinor: 500n, commissionMinor: 8n, deliveryMethod: DeliveryMethod.EXCHANGE,
      heldTransportMinor: 200n, payer: BUYER_ID, payoutMinor: 492n,
    },
    {
      acceptedMinor: 500n, commissionMinor: 8n, deliveryMethod: DeliveryMethod.EXCHANGE,
      heldTransportMinor: 200n, payer: SUPPLIER_ID, payoutMinor: 292n,
    },
    {
      acceptedMinor: 100n, commissionMinor: 2n, deliveryMethod: DeliveryMethod.EXCHANGE,
      heldTransportMinor: 98n, payer: SUPPLIER_ID, payoutMinor: 0n,
    },
    {
      acceptedMinor: 0n, commissionMinor: 0n, deliveryMethod: DeliveryMethod.EXCHANGE,
      heldTransportMinor: 0n, payer: SUPPLIER_ID, payoutMinor: 0n,
    },
    {
      acceptedMinor: 1_000n, commissionMinor: 15n, deliveryMethod: DeliveryMethod.CUSTOMER,
      heldTransportMinor: 0n, payer: BUYER_ID, payoutMinor: 985n,
    },
  ])('settles $acceptedMinor for $deliveryMethod with transport payer $payer', async ({
    acceptedMinor, commissionMinor, deliveryMethod, heldTransportMinor, payer, payoutMinor,
  }) => {
    const { runtime, storage } = createTestRuntime();
    const isExchange = deliveryMethod === DeliveryMethod.EXCHANGE;
    const isSupplierPayer = isExchange && payer === SUPPLIER_ID;
    const shippingMinor = deliveryMethod === DeliveryMethod.CUSTOMER || isSupplierPayer ? 0n : SHIPPING_MINOR;
    const fundedMinor = GOODS_MINOR + shippingMinor;
    const deal = create(DealSchema, {
      customerOrganizationId: BUYER_ID,
      deliveryMethod,
      goodsTotal: rub(GOODS_MINOR),
      id: 'deal',
      status: DealStatus.CLAIM,
      supplierOrganizationId: SUPPLIER_ID,
    });
    const trip = create(TripRecordSchema, {
      customerOrganizationId: BUYER_ID,
      dealId: deal.id,
      id: 'trip',
      status: TripStatus.ARRIVED,
      supplierOrganizationId: SUPPLIER_ID,
      transportOrder: { amount: rub(SHIPPING_MINOR), carrierOrganizationId: CARRIER_ID, shipperOrganizationId: payer },
      version: 1,
    });
    const transportSettlement = isExchange ? buildTransportSettlement(runtime.errors, deal, trip) : undefined;
    const payment = createInvoicedPayment(deal.id, rub(GOODS_MINOR), rub(shippingMinor));
    payment.status = SafeDealPaymentStatus.HELD;
    payment.fundedAmount = transportSettlement?.fundedAmount;
    if (isExchange) {
      await loadExchangePayments();
    }
    await runtime.command((transaction) => {
      transaction.put('deals', deal);
      if (isExchange) {
        transaction.put('trips', trip);
      }
      transaction.put('payments', create(SafeDealPaymentRecordSchema, { id: deal.id, payment, transportSettlement }));
    });

    await runtime.command((transaction) => {
      schedulePartialReceiptPayout(runtime, transaction, deal, acceptedMinor);
    });
    const record = runtime.read.get('payments', deal.id);
    const pendingPayouts = payoutMinor === 0n
      ? []
      : [{ amount: rub(payoutMinor), organizationId: SUPPLIER_ID, status: PayoutStatus.PENDING }];
    expect(record?.payment).toMatchObject({
      commissionAmount: rub(15n),
      deliveryAmount: rub(shippingMinor),
      goodsAmount: rub(GOODS_MINOR),
      partialReceipt: {
        acceptedGoodsAmount: rub(acceptedMinor),
        acceptedGoodsCommission: rub(commissionMinor),
        disputedGoodsAmount: rub(GOODS_MINOR - acceptedMinor),
        heldTransportAmount: rub(heldTransportMinor),
      },
      payouts: pendingPayouts,
      status: SafeDealPaymentStatus.DISPUTE,
      transitions: [{ from: SafeDealPaymentStatus.HELD, to: SafeDealPaymentStatus.DISPUTE }],
    });
    expect(payoutMinor + commissionMinor + GOODS_MINOR - acceptedMinor + heldTransportMinor).toBe(fundedMinor);
    expect(record?.transportSettlement).toEqual(transportSettlement);
    expect(runtime.read.get('deals', deal.id)?.status).toBe(DealStatus.CLAIM);
    if (isExchange && record !== undefined) {
      const nonPayer = isSupplierPayer ? BUYER_ID : SUPPLIER_ID;
      expect(projectPayment(record, deal, payer)?.partialReceipt?.heldTransportAmount).toEqual(rub(heldTransportMinor));
      const nonPayerView = projectPayment(record, deal, nonPayer);
      expect(nonPayerView?.partialReceipt).toMatchObject({
        disputedGoodsAmount: rub(GOODS_MINOR - acceptedMinor),
        heldTransportAmount: undefined,
      });
      expect(nonPayerView?.payouts).toEqual(isSupplierPayer ? [] : record.payment?.payouts);
      expect(projectPayment(record, deal, CARRIER_ID)).toBeUndefined();
      expect(runtime.read.get('trips', trip.id)?.status).toBe(TripStatus.DELIVERED);
      expect(readCarrierTripPayment(runtime.read, trip)?.carrierPayout).toBeUndefined();
    }

    await expect(runtime.command((transaction) => {
      schedulePartialReceiptPayout(runtime, transaction, deal, acceptedMinor);
    })).rejects.toThrow('invalid_transition');
    const dueAt = record?.bankDueAt;
    expect(dueAt === undefined).toBe(payoutMinor === 0n);
    if (dueAt === undefined) {
      return;
    }
    const snapshot = await storage.load();
    if (snapshot === undefined) {
      throw new Error('Expected a persisted payment snapshot');
    }
    const reopened = createEngineState(snapshot);
    const tick = (at: number): void => {
      reopened.transact(at, (transaction) => {
        runPaymentTask(runtime, transaction);
      }, () => reopened.getMeta()).apply();
    };
    tick(timestampMs(dueAt) - 1);
    expect(reopened.read.get('payments', deal.id)?.payment?.payouts[0]?.status).toBe(PayoutStatus.PENDING);
    tick(timestampMs(dueAt));
    const settled = reopened.read.get('payments', deal.id);
    expect(settled?.bankDueAt).toBeUndefined();
    expect(settled?.payment).toMatchObject({
      payouts: [{ amount: rub(payoutMinor), organizationId: SUPPLIER_ID, paidAt: dueAt, status: PayoutStatus.PAID }],
      status: SafeDealPaymentStatus.DISPUTE,
      version: (record?.payment?.version ?? 0) + 1,
    });
    expect(reopened.read.get('deals', deal.id)?.status).toBe(DealStatus.CLAIM);
    if (isExchange) {
      expect(reopened.read.get('trips', trip.id)?.status).toBe(TripStatus.DELIVERED);
      expect(readCarrierTripPayment(reopened.read, trip)?.carrierPayout).toBeUndefined();
    }
    tick(timestampMs(dueAt) + 60_000);
    expect(reopened.read.get('payments', deal.id)).toEqual(settled);
  });
});
