import type { Money } from '@skladburg/contracts/common/v1/money';
import type { SafeDealPayment } from '@skladburg/contracts/payment/v1/payment';

import { create } from '@bufbuild/protobuf';
import {
  SafeDealPaymentSchema,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';

import { rub } from '../deals/dealRules';
import {
  calculateCommissionMinor,
  COMMISSION_RATE_BASIS_POINTS,
} from './paymentRules';

export const createInvoicedPayment = (dealId: string, goodsAmount: Money, deliveryAmount: Money): SafeDealPayment =>
  create(SafeDealPaymentSchema, {
    commissionAmount: rub(calculateCommissionMinor(goodsAmount.amountMinor)),
    commissionRateBasisPoints: COMMISSION_RATE_BASIS_POINTS,
    dealId,
    deliveryAmount,
    goodsAmount,
    id: dealId,
    status: SafeDealPaymentStatus.INVOICED,
    version: 1,
  });
