import type { ServiceImpl } from '@connectrpc/connect';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  AcceptDealResponseSchema,
  CancelDealResponseSchema,
  ChooseDeliveryResponseSchema,
  DealSchema,
  DealService,
  DealStatus,
  GetDealResponseSchema,
  ListDealsResponseSchema,
  MarkDealShippedResponseSchema,
  RejectCounterOfferResponseSchema,
  RejectDealResponseSchema,
} from '@skladburg/contracts/deal/v1/deal';
import { DealNotice } from '@skladburg/contracts/notification/v1/notification';
import {
  isSearchQueryMatched,
  parseSearchQuery,
} from '@skladburg/contracts/runtime';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { loadDocuments } from '../documents/loadDocuments';
import { paginate } from '../pagination';
import {
  loadPayments,
  loadShipmentPayments,
} from '../payments/loadPayments';
import { readVisibleDeal } from './dealAccess';
import { runDealCommand } from './dealCommand';
import { createDealDeadlines } from './dealDeadlines';
import { projectDeal } from './dealProjection';
import {
  failDealValidation,
  rub,
} from './dealRules';
import { isDealVisibleToOrganization } from './dealVisibility';
import { loadDealNegotiation } from './loadDealNegotiation';

export const createDealService = (runtime: IModuleRuntime): ServiceImpl<typeof DealService> => {
  const endNegotiation = (transaction: IStateTransaction, deal: Deal): Deal => {
    const next = clone(DealSchema, deal);
    next.deadlines = createDealDeadlines(runtime, transaction, next, 'clear');
    return next;
  };
  return {
    ...loadDealNegotiation(runtime),
    acceptDeal: async (request, context) => {
      const { scheduleAcceptedPayout } = await loadPayments();
      return runDealCommand(runtime, {
        command: 'acceptDeal',
        handle: (transaction, _caller, deal) => {
          const next = clone(DealSchema, deal);
          if (transaction.get('warehouseInbound', deal.id) !== undefined) {
            throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], DealStatus[DealStatus.ACCEPTED]);
          }
          scheduleAcceptedPayout(runtime, transaction, next);
          return next;
        },
        headers: context.requestHeader,
        method: DealService.method.acceptDeal,
        notice: DealNotice.ACCEPTED,
        request,
        response: deal => create(AcceptDealResponseSchema, { deal }),
      });
    },
    cancelDeal: async (request, context) => {
      const [{ annulDealDocuments }, { cancelTransportRequest }, { refundDealPayment }, outbound] = await Promise.all([
        loadDocuments(),
        import('../logistics/transportLifecycle'),
        loadPayments(),
        runtime.openOutboundTask === undefined ? undefined : import('../wms/outboundReservation'),
      ]);
      return runDealCommand(runtime, {
        command: 'cancelDeal',
        handle: (transaction, caller, deal) => {
          if (outbound !== undefined) {
            const actorUserId = caller.organizationId === deal.supplierOrganizationId ? caller.user.id : '';
            outbound.cancelOutboundReservation(transaction, runtime, deal, actorUserId);
          }
          annulDealDocuments(transaction, deal);
          cancelTransportRequest(runtime, transaction, deal.id);
          refundDealPayment(runtime, transaction, deal);
          return endNegotiation(transaction, deal);
        },
        headers: context.requestHeader,
        method: DealService.method.cancelDeal,
        notice: DealNotice.CANCELLED,
        reason: request.reason,
        request,
        response: deal => create(CancelDealResponseSchema, { deal }),
      });
    },
    chooseDelivery: async (request, context) => {
      const { issueDealDocuments } = await loadDocuments();
      return runDealCommand(runtime, {
        command: 'chooseDelivery',
        handle: (transaction, _caller, deal) => {
          if (deal.deliveryMethod === DeliveryMethod.EXCHANGE || request.deliveryMethod === DeliveryMethod.EXCHANGE
            || (request.deliveryMethod === DeliveryMethod.SUPPLIER && deal.deliveryTotal === undefined)) {
            failDealValidation(runtime.errors, 'delivery_method', 'deal.delivery_method.unavailable');
          }
          const next = clone(DealSchema, deal);
          next.deliveryMethod = request.deliveryMethod;
          if (request.deliveryMethod === DeliveryMethod.CUSTOMER) {
            next.deliveryTotal = rub(0n);
          }
          issueDealDocuments(runtime, transaction, next);
          return next;
        },
        headers: context.requestHeader,
        method: DealService.method.chooseDelivery,
        notice: DealNotice.DOCUMENTS_READY,
        request,
        response: deal => create(ChooseDeliveryResponseSchema, { deal }),
      });
    },
    confirmDealReceipt: async (request, context) => (await import('./dealReceipt')).confirmDealReceipt(runtime, request, context),
    getDeal: (request, context) => {
      const caller = runtime.guard.guardPermissionCall(runtime.read, DealService.method.getDeal, request, context.requestHeader);
      const deal = readVisibleDeal(runtime.read, runtime.errors, request.dealId, caller);
      return create(GetDealResponseSchema,
        { contract: runtime.read.get('supplyContracts',
          deal.contractId),
        deal: projectDeal(deal,
          caller.organizationId) });
    },
    getDealReceipt: async (request, context) => (await import('./dealReceipt')).getDealReceipt(runtime, request, context),
    listDeals: (request, context) => {
      const caller = runtime.guard.guardPermissionCall(runtime.read, DealService.method.listDeals, request, context.requestHeader);
      if (caller.admission.kind !== 'membership') {
        throw runtime.errors.permissionDenied('deal_view');
      }
      const query = parseSearchQuery(request.query);
      const candidates = [
        ...runtime.read.listBy('deals', 'customerOrganizationId', caller.organizationId),
        ...runtime.read.listBy('deals', 'supplierOrganizationId', caller.organizationId),
      ].filter((deal) => {
        const counterpartyId = deal.customerOrganizationId === caller.organizationId
          ? deal.supplierOrganizationId
          : deal.customerOrganizationId;
        return isDealVisibleToOrganization(deal, caller.organizationId)
          && (request.status === DealStatus.UNSPECIFIED || request.status === deal.status)
          && (request.counterpartyOrganizationId === '' || request.counterpartyOrganizationId === counterpartyId)
          && isSearchQueryMatched(query, [String(deal.number), runtime.read.get('organizations', counterpartyId)?.name ?? '',
            ...deal.lines.map(line => line.productSnapshot?.name ?? '')]);
      }).sort((current, prev) => prev.number - current.number);
      const { items, page } = paginate(candidates, deal => deal.id, request.page, runtime.errors);
      return create(ListDealsResponseSchema, { deals: items.map(deal => projectDeal(deal, caller.organizationId)), page });
    },
    markDealShipped: async (request, context) => {
      const { holdPaymentForShipment } = await loadShipmentPayments(runtime.read, request.dealId);
      return runDealCommand(runtime, {
        command: 'markDealShipped',
        handle: (transaction, _caller, deal) => {
          const next = clone(DealSchema, deal);
          if (transaction.get('warehouseOutbound', deal.id) !== undefined) {
            throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], DealStatus[DealStatus.SHIPPED]);
          }
          holdPaymentForShipment(runtime, transaction, next, undefined);
          return next;
        },
        headers: context.requestHeader,
        method: DealService.method.markDealShipped,
        notice: DealNotice.SHIPPED,
        request,
        response: deal => create(MarkDealShippedResponseSchema, { deal }),
      });
    },
    openDealReceiptClaim: async (request, context) => (await import('./dealReceipt')).openDealReceiptClaim(runtime, request, context),
    rejectCounterOffer: (request, context) => runDealCommand(runtime, {
      command: 'rejectCounterOffer',
      handle: (transaction, _caller, deal) => endNegotiation(transaction, deal),
      headers: context.requestHeader,
      method: DealService.method.rejectCounterOffer,
      notice: DealNotice.REJECTED,
      reason: request.reason,
      request,
      response: deal => create(RejectCounterOfferResponseSchema, { deal }),
    }),
    rejectDeal: (request, context) => runDealCommand(runtime, {
      command: 'rejectDeal',
      handle: (transaction, _caller, deal) => endNegotiation(transaction, deal),
      headers: context.requestHeader,
      method: DealService.method.rejectDeal,
      notice: DealNotice.REJECTED,
      reason: request.reason,
      request,
      response: deal => create(RejectDealResponseSchema, { deal }),
    }),
  };
};
