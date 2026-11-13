import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  type SafeDealPayment,
  SafeDealPaymentStatus,
  SafeDealPaymentTransitionSchema,
} from '@skladburg/contracts/payment/v1/payment';

import type { IDomainErrors } from '../../errors/index';

import { createStateMachine } from '../../machine/index';

const target = (status: SafeDealPaymentStatus): { status: SafeDealPaymentStatus } => ({ status });

const transitions = {
  block: { [SafeDealPaymentStatus.AWAITING_FUNDS]: target(SafeDealPaymentStatus.BLOCKED) },
  close: { [SafeDealPaymentStatus.PAID_OUT]: target(SafeDealPaymentStatus.CLOSED) },
  dispute: { [SafeDealPaymentStatus.HELD]: target(SafeDealPaymentStatus.DISPUTE) },
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
    dispute: SafeDealPaymentStatus.DISPUTE,
    fund: SafeDealPaymentStatus.AWAITING_FUNDS,
    hold: SafeDealPaymentStatus.HELD,
    payOut: SafeDealPaymentStatus.PAID_OUT,
    refund: SafeDealPaymentStatus.REFUNDED,
    release: SafeDealPaymentStatus.TO_PAYOUT,
  },
  statusName: status => SafeDealPaymentStatus[status],
  transitions,
});

export const advancePayment = (
  errors: IDomainErrors,
  payment: SafeDealPayment,
  command: PaymentCommand,
  worldTimeMs: number,
  expectedVersion?: number,
): void => {
  const { status } = paymentMachine.requireTransition(errors, command, payment, expectedVersion);
  bumpPaymentVersion(errors, payment);
  payment.transitions.push(create(SafeDealPaymentTransitionSchema, {
    at: timestampFromMs(worldTimeMs),
    from: payment.status,
    to: status,
  }));
  payment.status = status;
};

export const bumpPaymentVersion = (errors: IDomainErrors, payment: SafeDealPayment): void => {
  if (payment.version >= 2_147_483_647) {
    throw errors.unavailable();
  }
  payment.version++;
};
