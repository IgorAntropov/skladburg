import type { Money } from '@skladburg/contracts/common/v1/money';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  type SafeDealPayment,
  SafeDealPaymentSchema,
  SafeDealPaymentStatus,
  SafeDealPaymentTransitionSchema,
} from '@skladburg/contracts/payment/v1/payment';

import type { IDomainErrors } from '../../errors/index';

import { createStateMachine } from '../../machine/index';
import { rub } from '../deals/dealRules';
import {
  calculateCommissionMinor,
  COMMISSION_RATE_BASIS_POINTS,
} from './paymentRules';

const target = (status: SafeDealPaymentStatus): { status: SafeDealPaymentStatus } => ({ status });

const transitions = {
  block: { [SafeDealPaymentStatus.AWAITING_FUNDS]: target(SafeDealPaymentStatus.BLOCKED) },
  close: { [SafeDealPaymentStatus.PAID_OUT]: target(SafeDealPaymentStatus.CLOSED) },
  fund: { [SafeDealPaymentStatus.INVOICED]: target(SafeDealPaymentStatus.AWAITING_FUNDS) },
  hold: { [SafeDealPaymentStatus.BLOCKED]: target(SafeDealPaymentStatus.HELD) },
  payOut: { [SafeDealPaymentStatus.TO_PAYOUT]: target(SafeDealPaymentStatus.PAID_OUT) },
  refund: {
    [SafeDealPaymentStatus.AWAITING_FUNDS]: target(SafeDealPaymentStatus.REFUNDED),
    [SafeDealPaymentStatus.BLOCKED]: target(SafeDealPaymentStatus.REFUNDED),
  },
  release: { [SafeDealPaymentStatus.HELD]: target(SafeDealPaymentStatus.TO_PAYOUT) },
};

type PaymentCommand = keyof typeof transitions;

const paymentMachine = createStateMachine<PaymentCommand, SafeDealPaymentStatus, { status: SafeDealPaymentStatus }>({
  entity: EntityKind.PAYMENT,
  intendedStatuses: {
    block: SafeDealPaymentStatus.BLOCKED,
    close: SafeDealPaymentStatus.CLOSED,
    fund: SafeDealPaymentStatus.AWAITING_FUNDS,
    hold: SafeDealPaymentStatus.HELD,
    payOut: SafeDealPaymentStatus.PAID_OUT,
    refund: SafeDealPaymentStatus.REFUNDED,
    release: SafeDealPaymentStatus.TO_PAYOUT,
  },
  statusName: status => SafeDealPaymentStatus[status],
  transitions,
});

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

export const advancePayment = (
  errors: IDomainErrors,
  payment: SafeDealPayment,
  command: PaymentCommand,
  worldTimeMs: number,
  expectedVersion?: number,
): void => {
  const { status } = paymentMachine.requireTransition(errors, command, payment, expectedVersion);
  if (payment.version >= 2_147_483_647) {
    throw errors.unavailable();
  }
  payment.transitions.push(create(SafeDealPaymentTransitionSchema, {
    at: timestampFromMs(worldTimeMs),
    from: payment.status,
    to: status,
  }));
  payment.status = status;
  payment.version++;
};
