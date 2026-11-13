import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  PartialReceiptSettlementSchema,
  PayoutStatus,
  SafeDealPayoutSchema,
} from '@skladburg/contracts/payment/v1/payment';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { rub } from '../deals/dealRules';
import { getExchangePayments } from './loadExchangePayments';
import { writePayment } from './paymentLifecycle';
import { advancePayment } from './paymentMachine';
import { calculateCommissionMinor } from './paymentRules';

export const schedulePartialReceiptPayout = (
  runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal, acceptedGoodsMinor: bigint,
): void => {
  const record = transaction.get('payments', deal.id);
  const payment = record?.payment;
  const goods = payment?.goodsAmount?.amountMinor;
  const delivery = payment?.deliveryAmount?.amountMinor;
  if (record === undefined || payment === undefined || goods === undefined || delivery === undefined
    || acceptedGoodsMinor < 0n || acceptedGoodsMinor > goods || deal.status !== DealStatus.CLAIM) {
    throw runtime.errors.internal();
  }
  advancePayment(runtime.errors, payment, 'dispute', transaction.worldTimeMs);

  const commission = calculateCommissionMinor(acceptedGoodsMinor);
  const acceptedNet = acceptedGoodsMinor - commission;
  const isSupplierPayer = record.transportSettlement?.payerOrganizationId === deal.supplierOrganizationId;
  const shipping = record.transportSettlement?.shippingAmount?.amountMinor;
  if (isSupplierPayer && shipping === undefined) {
    throw runtime.errors.internal();
  }
  const reserved = isSupplierPayer && shipping !== undefined ? (shipping < acceptedNet ? shipping : acceptedNet) : 0n;
  const payout = acceptedNet - reserved;
  const heldTransport = delivery + reserved;
  const disputed = goods - acceptedGoodsMinor;
  if (payment.payouts.length > 0
    || payout + commission + heldTransport + disputed !== (payment.fundedAmount?.amountMinor ?? goods + delivery)) {
    throw runtime.errors.internal();
  }

  payment.partialReceipt = create(PartialReceiptSettlementSchema, {
    acceptedGoodsAmount: rub(acceptedGoodsMinor),
    acceptedGoodsCommission: rub(commission),
    disputedGoodsAmount: rub(disputed),
    heldTransportAmount: rub(heldTransport),
  });
  getExchangePayments(runtime.errors, deal)?.markTripAccepted(runtime, transaction, deal);
  if (payout > 0n) {
    payment.payouts.push(create(SafeDealPayoutSchema, {
      amount: rub(payout),
      organizationId: deal.supplierOrganizationId,
      status: PayoutStatus.PENDING,
    }));
    record.bankDueAt = timestampFromMs(runtime.paymentProvider.schedulePayout(transaction.worldTimeMs));
  }
  writePayment(runtime, transaction, deal, record);
};
