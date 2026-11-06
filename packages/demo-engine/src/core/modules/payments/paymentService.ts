import type { ServiceImpl } from '@connectrpc/connect';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { DealChange } from '@skladburg/contracts/deal/v1/deal_events';
import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  FundDealResponseSchema,
  GetDealPaymentResponseSchema,
  PaymentService,
  type SafeDealPayment,
  SafeDealPaymentRecordSchema,
  SafeDealPaymentSchema,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';

import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  enforcePermissionAmountLimit,
  resolvePermissionGrants,
} from '../../access/index';
import {
  readVisibleDeal,
  requireDealPartyProfiles,
} from '../deals/dealAccess';
import { publishDealEffects } from '../deals/dealEffects';
import {
  failDealValidation,
  rub,
} from '../deals/dealRules';
import { planDeliveryDeadlines } from './paymentLifecycle';
import { advancePayment } from './paymentMachine';

const COMMISSION_RATE_BASIS_POINTS = 150;

const readSignedInvoice = (reader: IStateReader, dealId: string): undefined | {
  deliveryAmount: NonNullable<SafeDealPayment['deliveryAmount']>;
  goodsAmount: NonNullable<SafeDealPayment['goodsAmount']>;
  total: NonNullable<SafeDealPayment['goodsAmount']>;
} => {
  const invoice = reader.listBy('documents', 'dealId', dealId).find(
    document => document.type === DocumentType.INVOICE && document.status === DocumentStatus.SIGNED,
  );
  const terms = invoice?.content?.terms;
  if (terms?.case !== 'invoice') {
    return undefined;
  }
  const { deliveryTotal, goodsTotal, total } = terms.value;
  if (deliveryTotal === undefined || goodsTotal === undefined || total === undefined) {
    return undefined;
  }
  return { deliveryAmount: deliveryTotal, goodsAmount: goodsTotal, total };
};

const invoicePayment = (deal: Deal, invoice: NonNullable<ReturnType<typeof readSignedInvoice>>): SafeDealPayment => {
  const { deliveryAmount, goodsAmount } = invoice;
  const commission = (goodsAmount.amountMinor * BigInt(COMMISSION_RATE_BASIS_POINTS) + 5_000n) / 10_000n;
  return create(SafeDealPaymentSchema, {
    commissionAmount: rub(commission),
    commissionRateBasisPoints: COMMISSION_RATE_BASIS_POINTS,
    dealId: deal.id,
    deliveryAmount,
    goodsAmount,
    id: deal.id,
    status: SafeDealPaymentStatus.INVOICED,
    version: 1,
  });
};

export const createPaymentService = (runtime: IModuleRuntime): ServiceImpl<typeof PaymentService> => ({
  fundDeal: (request, context) => runtime.command((transaction) => {
    const method = PaymentService.method.fundDeal;
    const caller = runtime.guard.guardPermissionCall(transaction, method, request, context.requestHeader);
    return runtime.idempotency.run(transaction, {
      handler: () => {
        const deal = readVisibleDeal(transaction, runtime.errors, request.dealId, caller);
        if (caller.admission.kind !== 'membership' || deal.customerOrganizationId !== caller.organizationId) {
          throw runtime.errors.permissionDenied('payment_fund');
        }
        const invoice = readSignedInvoice(transaction, deal.id);
        const current = transaction.get('payments', deal.id)?.payment;
        const payment = current ?? (invoice === undefined ? undefined : invoicePayment(deal, invoice));
        if (payment === undefined) {
          throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], DealStatus[DealStatus.PAID]);
        }
        advancePayment(runtime.errors, payment, 'fund', transaction.worldTimeMs, request.expectedVersion);
        if (deal.status !== DealStatus.AWAITING_PAYMENT || invoice === undefined) {
          throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], DealStatus[DealStatus.PAID]);
        }
        const grants = resolvePermissionGrants(transaction, caller.admission.membership);
        enforcePermissionAmountLimit(grants, 'payment_fund', invoice.total, runtime.errors);
        if (request.amount?.amountMinor !== invoice.total.amountMinor || request.amount.currencyCode !== invoice.total.currencyCode) {
          failDealValidation(runtime.errors, 'amount', 'payment.amount.mismatch');
        }
        requireDealPartyProfiles(transaction, runtime.errors, deal.supplierOrganizationId, deal.customerOrganizationId);
        if (deal.deadlines?.paymentDueAt === undefined) {
          throw runtime.errors.unavailable();
        }
        planDeliveryDeadlines(runtime, transaction, deal);
        const funding = runtime.paymentProvider.scheduleFunding(transaction.worldTimeMs);
        payment.bankReference = funding.reference;
        transaction.put('payments', create(SafeDealPaymentRecordSchema, {
          bankDueAt: timestampFromMs(funding.dueAtMs),
          id: deal.id,
          payment,
        }));
        publishDealEffects(runtime, transaction, deal, undefined, DealChange.PAYMENT, caller.organizationId);
        return create(FundDealResponseSchema, { payment });
      },
      idempotencyKey: request.idempotencyKey,
      method,
      request,
      scope: caller.organizationId,
    });
  }),
  getDealPayment: (request, context) => {
    const caller = runtime.guard.guardPermissionCall(
      runtime.read, PaymentService.method.getDealPayment, request, context.requestHeader,
    );
    const deal = readVisibleDeal(runtime.read, runtime.errors, request.dealId, caller);
    const current = runtime.read.get('payments', deal.id)?.payment;
    const invoice = current === undefined && deal.status === DealStatus.AWAITING_PAYMENT
      ? readSignedInvoice(runtime.read, deal.id)
      : undefined;
    return create(GetDealPaymentResponseSchema, { payment: invoice === undefined ? current : invoicePayment(deal, invoice) });
  },
});
