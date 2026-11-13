import type { ServiceImpl } from '@connectrpc/connect';
import type { Money } from '@skladburg/contracts/common/v1/money';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { SafeDealPaymentRecord } from '@skladburg/contracts/payment/v1/payment';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  FundDealResponseSchema,
  GetDealPaymentResponseSchema,
  PaymentService,
  SafeDealPaymentRecordSchema,
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
import { failDealValidation } from '../deals/dealRules';
import { createInvoicedPayment } from './invoicedPayment';
import {
  getExchangePayments,
  loadExchangePayments,
} from './loadExchangePayments';
import {
  planDeliveryDeadlines,
  writePayment,
} from './paymentLifecycle';
import { advancePayment } from './paymentMachine';

export interface SignedInvoiceValue {
  deliveryAmount: Money;
  goodsAmount: Money;
  total: Money;
}

const readSignedInvoice = (reader: IStateReader, dealId: string): SignedInvoiceValue | undefined => {
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

const invoiceRecord = (
  runtime: IModuleRuntime,
  reader: IStateReader,
  deal: Deal,
  invoice: SignedInvoiceValue,
): SafeDealPaymentRecord => getExchangePayments(runtime.errors, deal)?.createExchangeInvoiceRecord(runtime, reader, deal, invoice)
  ?? create(SafeDealPaymentRecordSchema, {
    id: deal.id,
    payment: createInvoicedPayment(deal.id, invoice.goodsAmount, invoice.deliveryAmount),
  });

export const createPaymentService = (runtime: IModuleRuntime): ServiceImpl<typeof PaymentService> => ({
  fundDeal: async (request, context) => {
    const method = PaymentService.method.fundDeal;
    if (runtime.read.get('deals', request.dealId)?.deliveryMethod === DeliveryMethod.EXCHANGE) {
      const caller = runtime.guard.guardPermissionCall(runtime.read, method, request, context.requestHeader);
      readVisibleDeal(runtime.read, runtime.errors, request.dealId, caller);
      await loadExchangePayments();
    }

    return runtime.command((transaction) => {
      const caller = runtime.guard.guardPermissionCall(transaction, method, request, context.requestHeader);
      return runtime.idempotency.run(transaction, {
        handler: () => {
          const deal = readVisibleDeal(transaction, runtime.errors, request.dealId, caller);
          if (caller.admission.kind !== 'membership' || deal.customerOrganizationId !== caller.organizationId) {
            throw runtime.errors.permissionDenied('payment_fund');
          }
          const invoice = readSignedInvoice(transaction, deal.id);
          const record = transaction.get('payments', deal.id)
            ?? (invoice === undefined ? undefined : invoiceRecord(runtime, transaction, deal, invoice));
          if (record?.payment === undefined) {
            throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], DealStatus[DealStatus.PAID]);
          }
          const { payment } = record;
          advancePayment(runtime.errors, payment, 'fund', transaction.worldTimeMs, request.expectedVersion);
          if (deal.status !== DealStatus.AWAITING_PAYMENT || invoice === undefined) {
            throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], DealStatus[DealStatus.PAID]);
          }
          const fundedAmount = payment.fundedAmount ?? invoice.total;
          const grants = resolvePermissionGrants(transaction, caller.admission.membership);
          enforcePermissionAmountLimit(grants, 'payment_fund', fundedAmount, runtime.errors);
          if (request.amount?.amountMinor !== fundedAmount.amountMinor || request.amount.currencyCode !== fundedAmount.currencyCode) {
            failDealValidation(runtime.errors, 'amount', 'payment.amount.mismatch');
          }
          requireDealPartyProfiles(transaction, runtime.errors, deal.supplierOrganizationId, deal.customerOrganizationId);
          if (deal.deadlines?.paymentDueAt === undefined) {
            throw runtime.errors.unavailable();
          }
          const exchange = getExchangePayments(runtime.errors, deal);
          if (exchange === undefined) {
            planDeliveryDeadlines(runtime, transaction, deal);
          }
          const funding = runtime.paymentProvider.scheduleFunding(transaction.worldTimeMs);
          payment.bankReference = funding.reference;
          record.bankDueAt = timestampFromMs(funding.dueAtMs);
          writePayment(runtime, transaction, deal, record, caller.organizationId);
          exchange?.publishCarrierPaymentChange(runtime, transaction, record);
          return create(FundDealResponseSchema, {
            payment: exchange === undefined ? payment : exchange.projectPayment(record, deal, caller.organizationId),
          });
        },
        idempotencyKey: request.idempotencyKey,
        method,
        request,
        scope: caller.organizationId,
      });
    });
  },
  getDealPayment: async (request, context) => {
    const caller = runtime.guard.guardPermissionCall(
      runtime.read, PaymentService.method.getDealPayment, request, context.requestHeader,
    );
    const deal = readVisibleDeal(runtime.read, runtime.errors, request.dealId, caller);
    const current = runtime.read.get('payments', deal.id);
    const invoice = current === undefined && deal.status === DealStatus.AWAITING_PAYMENT
      ? readSignedInvoice(runtime.read, deal.id)
      : undefined;
    const exchange = deal.deliveryMethod === DeliveryMethod.EXCHANGE && (current !== undefined || invoice !== undefined)
      ? await loadExchangePayments()
      : undefined;
    const record = invoice === undefined ? current : invoiceRecord(runtime, runtime.read, deal, invoice);
    return create(GetDealPaymentResponseSchema, {
      payment: exchange === undefined || record === undefined
        ? record?.payment
        : exchange.projectPayment(record, deal, caller.organizationId),
    });
  },
});
