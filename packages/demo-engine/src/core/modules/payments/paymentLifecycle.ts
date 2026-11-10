import { create } from '@bufbuild/protobuf';
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  type Deal,
  type DealDeadlines,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import { DealChange } from '@skladburg/contracts/deal/v1/deal_events';
import { DealNotice } from '@skladburg/contracts/notification/v1/notification';
import {
  PayoutStatus,
  type SafeDealPaymentRecord,
  SafeDealPaymentStatus,
  SafeDealPayoutSchema,
} from '@skladburg/contracts/payment/v1/payment';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { getStartOfDayInstant } from '../../calendar/zonedTime';
import { createDealDeadlines } from '../deals/dealDeadlines';
import {
  advanceSystemDeal,
  postDealNotice,
  publishDealEffects,
} from '../deals/dealEffects';
import { rub } from '../deals/dealRules';
import { getExchangePayments } from './loadExchangePayments';
import { advancePayment } from './paymentMachine';

const MINUTE_MS = 60_000;
const ACCEPTANCE_NOTICE_LEAD_MS = 60 * MINUTE_MS;

const writePayment = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
  record: SafeDealPaymentRecord,
): void => {
  transaction.put('payments', record);
  publishDealEffects(runtime, transaction, deal, undefined, DealChange.PAYMENT, '');
};

export const planDeliveryDeadlines = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): DealDeadlines => {
  if ((deal.deliveryMethod !== DeliveryMethod.CUSTOMER && deal.deliveryMethod !== DeliveryMethod.SUPPLIER)
    || deal.desiredDate === undefined) {
    throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], DealStatus[DealStatus.SHIPPED]);
  }
  const warehouse = transaction.get('warehouses', deal.shipToWarehouseId);
  if (warehouse?.tenantId !== deal.customerOrganizationId) {
    throw runtime.errors.notFound(EntityKind.WAREHOUSE);
  }
  const arrivalMs = Math.max(getStartOfDayInstant(deal.desiredDate, warehouse.timeZone), transaction.worldTimeMs + MINUTE_MS);
  const deadlines = createDealDeadlines(runtime, transaction, deal, 'acceptance', arrivalMs);
  deadlines.arrivalDueAt = timestampFromMs(arrivalMs);
  return deadlines;
};

export const holdPaymentForShipment = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): void => {
  const record = transaction.get('payments', deal.id);
  if (record?.payment === undefined) {
    throw runtime.errors.internal();
  }
  deal.deadlines = getExchangePayments(runtime.errors, deal)?.prepareExchangeShipment(runtime, transaction, deal, record)
    ?? planDeliveryDeadlines(runtime, transaction, deal);
  advancePayment(runtime.errors, record.payment, 'hold', transaction.worldTimeMs);
  writePayment(runtime, transaction, deal, record);
};

export const scheduleAcceptedPayout = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): void => {
  const record = transaction.get('payments', deal.id);
  const payment = record?.payment;
  if (record === undefined || payment?.goodsAmount === undefined
    || payment.deliveryAmount === undefined || payment.commissionAmount === undefined) {
    throw runtime.errors.internal();
  }
  advancePayment(runtime.errors, payment, 'release', transaction.worldTimeMs);
  const exchange = getExchangePayments(runtime.errors, deal);
  if (exchange !== undefined) {
    exchange.appendExchangePayouts(runtime, transaction, deal, record);
  }
  else {
    payment.payouts.push(create(SafeDealPayoutSchema, {
      amount: rub(payment.goodsAmount.amountMinor + payment.deliveryAmount.amountMinor - payment.commissionAmount.amountMinor),
      organizationId: deal.supplierOrganizationId,
      status: PayoutStatus.PENDING,
    }));
  }
  const dueAt = runtime.paymentProvider.schedulePayout(transaction.worldTimeMs);
  record.bankDueAt = timestampFromMs(dueAt);
  writePayment(runtime, transaction, deal, record);
};

export const refundDealPayment = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): void => {
  const record = transaction.get('payments', deal.id);
  if (record?.payment === undefined) {
    return;
  }
  advancePayment(runtime.errors, record.payment, 'refund', transaction.worldTimeMs);
  record.bankDueAt = undefined;
  writePayment(runtime, transaction, deal, record);
};

const processBankOperation = (runtime: IModuleRuntime, transaction: IStateTransaction, record: SafeDealPaymentRecord): void => {
  const { payment } = record;
  if (payment === undefined || record.bankDueAt === undefined) {
    return;
  }
  const deal = transaction.get('deals', payment.dealId);
  if (deal === undefined) {
    throw runtime.errors.internal();
  }
  if (deal.status === DealStatus.ACCEPTED && payment.status === SafeDealPaymentStatus.TO_PAYOUT) {
    advanceSystemDeal(runtime, transaction, deal, 'settle');
  }
  if (timestampMs(record.bankDueAt) > transaction.worldTimeMs) {
    return;
  }
  if (payment.status === SafeDealPaymentStatus.AWAITING_FUNDS && deal.status === DealStatus.AWAITING_PAYMENT) {
    advancePayment(runtime.errors, payment, 'block', transaction.worldTimeMs);
    advanceSystemDeal(runtime, transaction, deal, 'fund', DealNotice.FUNDS_BLOCKED);
  }
  else if (payment.status === SafeDealPaymentStatus.TO_PAYOUT && deal.status === DealStatus.SETTLEMENT) {
    advancePayment(runtime.errors, payment, 'payOut', transaction.worldTimeMs);
    for (const payout of payment.payouts) {
      payout.paidAt = timestampFromMs(transaction.worldTimeMs);
      payout.status = PayoutStatus.PAID;
    }
    getExchangePayments(runtime.errors, deal)?.markTripPaid(runtime, transaction, deal);
    advancePayment(runtime.errors, payment, 'close', transaction.worldTimeMs);
    advanceSystemDeal(runtime, transaction, deal, 'close', DealNotice.PAID_OUT);
  }
  else {
    return;
  }
  record.bankDueAt = undefined;
  writePayment(runtime, transaction, deal, record);
};

const processDelivery = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
  record: SafeDealPaymentRecord,
): void => {
  const exchange = getExchangePayments(runtime.errors, deal);
  if (exchange !== undefined) {
    exchange.progressExchangeDelivery(runtime, transaction, deal);
  }
  else {
    if (deal.status === DealStatus.SHIPPED) {
      advanceSystemDeal(runtime, transaction, deal, 'startTransit');
    }
    const arrival = deal.deadlines?.arrivalDueAt;
    if (deal.status === DealStatus.IN_TRANSIT && arrival !== undefined && timestampMs(arrival) <= transaction.worldTimeMs) {
      advanceSystemDeal(runtime, transaction, deal, 'arrive', DealNotice.ARRIVED, deal.supplierOrganizationId);
    }
  }
  const acceptance = deal.deadlines?.acceptanceDueAt;
  if ((deal.status !== DealStatus.ARRIVED && deal.status !== DealStatus.ACCEPTING) || acceptance === undefined) {
    return;
  }
  const remaining = timestampMs(acceptance) - transaction.worldTimeMs;
  if (remaining <= 0) {
    scheduleAcceptedPayout(runtime, transaction, deal);
    advanceSystemDeal(runtime, transaction, deal, 'autoAccept', DealNotice.ACCEPTED);
  }
  else if (!record.acceptanceNoticeSent && remaining <= ACCEPTANCE_NOTICE_LEAD_MS) {
    postDealNotice(runtime, transaction, deal, DealNotice.ACCEPTANCE_DUE, deal.customerOrganizationId);
    record.acceptanceNoticeSent = true;
    transaction.put('payments', record);
  }
};

export const runPaymentTask = (runtime: IModuleRuntime, transaction: IStateTransaction): void => {
  for (const record of transaction.list('payments')) {
    processBankOperation(runtime, transaction, record);
    const deal = record.payment?.status === SafeDealPaymentStatus.HELD ? transaction.get('deals', record.id) : undefined;
    if (deal !== undefined) {
      processDelivery(runtime, transaction, deal, record);
    }
  }
};
