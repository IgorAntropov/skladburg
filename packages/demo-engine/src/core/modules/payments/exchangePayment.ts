import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  type Deal,
  type DealDeadlines,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { DealNotice } from '@skladburg/contracts/notification/v1/notification';
import {
  PayoutStatus,
  type SafeDealPaymentRecord,
  SafeDealPaymentRecordSchema,
  SafeDealPayoutSchema,
} from '@skladburg/contracts/payment/v1/payment';

import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { SignedInvoiceValue } from './paymentService';

import { createDealDeadlines } from '../deals/dealDeadlines';
import { advanceSystemDeal } from '../deals/dealEffects';
import { rub } from '../deals/dealRules';
import { publishTransportChanges } from '../logistics/transportEvents';
import {
  advanceTripDelivery,
  ceilTimestampMs,
  markTripAccepted,
  markTripPaid,
  readTripForDeal,
} from '../logistics/tripLifecycle';
import { createInvoicedPayment } from './invoicedPayment';
import { getTripShipment } from './loadPayments';
import { buildTransportSettlement } from './transportSettlement';

export { projectPayment } from './transportSettlement';
export {
  markTripAccepted,
  markTripPaid,
};

export const publishCarrierPaymentChange = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  record: SafeDealPaymentRecord,
): void => {
  const carrierId = record.transportSettlement?.carrierOrganizationId;
  if (carrierId === undefined) {
    throw runtime.errors.internal();
  }

  publishTransportChanges(runtime, transaction, [carrierId]);
};

export const createExchangeInvoiceRecord = (
  runtime: IModuleRuntime,
  reader: IStateReader,
  deal: Deal,
  invoice: SignedInvoiceValue,
): SafeDealPaymentRecord => {
  const { deliveryAmount, goodsAmount, total } = invoice;
  if (deliveryAmount.amountMinor !== 0n || total.amountMinor !== goodsAmount.amountMinor
    || total.currencyCode !== goodsAmount.currencyCode || deliveryAmount.currencyCode !== goodsAmount.currencyCode) {
    throw runtime.errors.internal();
  }
  const trip = readTripForDeal(reader, deal.id);
  if (trip?.transportOrder?.confirmedAt === undefined || trip.status === TripStatus.CANCELLED) {
    throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], DealStatus[DealStatus.PAID]);
  }
  if (deal.goodsTotal?.amountMinor !== goodsAmount.amountMinor || deal.goodsTotal.currencyCode !== goodsAmount.currencyCode) {
    throw runtime.errors.internal();
  }

  const settlement = buildTransportSettlement(runtime.errors, deal, trip);
  const { fundedAmount, shippingAmount } = settlement;
  if (fundedAmount === undefined || shippingAmount === undefined) {
    throw runtime.errors.internal();
  }

  const customerShipping = settlement.payerOrganizationId === deal.customerOrganizationId ? shippingAmount : rub(0n);
  const payment = createInvoicedPayment(deal.id, goodsAmount, customerShipping);
  payment.fundedAmount = fundedAmount;
  return create(SafeDealPaymentRecordSchema, {
    id: deal.id,
    payment,
    transportSettlement: settlement,
  });
};

export const prepareExchangeShipment = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
  record: SafeDealPaymentRecord,
): DealDeadlines => {
  const shipment = getTripShipment();
  if (shipment === undefined) {
    throw runtime.errors.unavailable();
  }
  shipment.markTripShipped(runtime, transaction, deal);
  const trip = readTripForDeal(transaction, deal.id);
  if (trip?.assignment?.arrivalAt === undefined || record.transportSettlement?.tripId !== trip.id) {
    throw runtime.errors.internal();
  }

  const plannedArrival = trip.assignment.arrivalAt;
  const deadlines = createDealDeadlines(runtime, transaction, deal, 'acceptance', ceilTimestampMs(plannedArrival));
  deadlines.arrivalDueAt = plannedArrival;
  deadlines.acceptanceDueAt = undefined;
  return deadlines;
};

export const progressExchangeDelivery = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): void => {
  if (deal.status !== DealStatus.SHIPPED && deal.status !== DealStatus.IN_TRANSIT) {
    return;
  }

  const { arrivedAtMs, hasDeparted } = advanceTripDelivery(runtime, transaction, deal);
  if (hasDeparted) {
    advanceSystemDeal(runtime, transaction, deal, 'startTransit');
  }
  if (arrivedAtMs !== undefined) {
    deal.deadlines = createDealDeadlines(runtime, transaction, deal, 'acceptance', arrivedAtMs);
    deal.deadlines.arrivalDueAt = timestampFromMs(arrivedAtMs);
    advanceSystemDeal(runtime, transaction, deal, 'arrive', DealNotice.ARRIVED, deal.supplierOrganizationId);
  }
};

export const appendExchangePayouts = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
  record: SafeDealPaymentRecord,
): void => {
  const { payment, transportSettlement } = record;
  const { carrierCommission, carrierPayout, fundedAmount, supplierPayout } = transportSettlement ?? {};
  const goodsCommission = payment?.commissionAmount;
  if (payment === undefined || transportSettlement === undefined || carrierCommission === undefined
    || carrierPayout === undefined || fundedAmount === undefined || goodsCommission === undefined || supplierPayout === undefined
    || payment.fundedAmount?.amountMinor !== fundedAmount.amountMinor || payment.payouts.length > 0
    || carrierPayout.amountMinor + supplierPayout.amountMinor + goodsCommission.amountMinor + carrierCommission.amountMinor
    !== fundedAmount.amountMinor) {
    throw runtime.errors.internal();
  }

  markTripAccepted(runtime, transaction, deal);
  payment.payouts.push(
    create(SafeDealPayoutSchema, {
      amount: supplierPayout,
      organizationId: deal.supplierOrganizationId,
      status: PayoutStatus.PENDING,
    }),
    create(SafeDealPayoutSchema, {
      amount: carrierPayout,
      organizationId: transportSettlement.carrierOrganizationId,
      status: PayoutStatus.PENDING,
    }),
  );
};
