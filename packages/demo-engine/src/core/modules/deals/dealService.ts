import type { ServiceImpl } from '@connectrpc/connect';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  CancelDealResponseSchema,
  ChooseDeliveryResponseSchema,
  DealSchema,
  DealService,
  DealStatus,
  GetDealResponseSchema,
  ListDealsResponseSchema,
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

import { paginate } from '../pagination';
import { readVisibleDeal } from './dealAccess';
import { runDealCommand } from './dealCommand';
import { createDealDeadlines } from './dealDeadlines';
import { createDealDraftHandlers } from './dealDraftHandlers';
import { createDealNegotiationHandlers } from './dealNegotiationHandlers';
import { projectDeal } from './dealProjection';
import {
  failDealValidation,
  rub,
} from './dealRules';
import { isDealVisibleToOrganization } from './dealVisibility';

export const createDealService = (runtime: IModuleRuntime): ServiceImpl<typeof DealService> => {
  const endNegotiation = (transaction: IStateTransaction, deal: Deal): Deal => {
    const next = clone(DealSchema, deal);
    next.deadlines = createDealDeadlines(runtime, transaction, next, 'clear');
    return next;
  };
  return {
    ...createDealDraftHandlers(runtime),
    ...createDealNegotiationHandlers(runtime),
    acceptDeal: (request, context) => {
      runtime.guard.guardPermissionCall(runtime.read, DealService.method.acceptDeal, request, context.requestHeader);
      throw runtime.errors.unavailable();
    },
    cancelDeal: (request, context) => runDealCommand(runtime, {
      command: 'cancelDeal',
      handle: (transaction, _caller, deal) => endNegotiation(transaction, deal),
      headers: context.requestHeader,
      method: DealService.method.cancelDeal,
      notice: DealNotice.CANCELLED,
      reason: request.reason,
      request,
      response: deal => create(CancelDealResponseSchema, { deal }),
    }),
    chooseDelivery: (request, context) => runDealCommand(runtime, {
      command: 'chooseDelivery',
      handle: (_transaction, _caller, deal) => {
        if (request.deliveryMethod === DeliveryMethod.EXCHANGE
          || (request.deliveryMethod === DeliveryMethod.SUPPLIER && deal.deliveryTotal === undefined)) {
          failDealValidation(runtime.errors, 'delivery_method', 'deal.delivery_method.unavailable');
        }
        const next = clone(DealSchema, deal);
        next.deliveryMethod = request.deliveryMethod;
        if (request.deliveryMethod === DeliveryMethod.CUSTOMER) {
          next.deliveryTotal = rub(0n);
        }
        return next;
      },
      headers: context.requestHeader,
      method: DealService.method.chooseDelivery,
      notice: undefined,
      request,
      response: deal => create(ChooseDeliveryResponseSchema, { deal }),
    }),
    getDeal: (request, context) => {
      const caller = runtime.guard.guardPermissionCall(runtime.read, DealService.method.getDeal, request, context.requestHeader);
      const deal = readVisibleDeal(runtime.read, runtime.errors, request.dealId, caller);
      return create(GetDealResponseSchema,
        { contract: runtime.read.get('supplyContracts',
          deal.contractId),
        deal: projectDeal(deal,
          caller.organizationId) });
    },
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
    markDealShipped: (request, context) => {
      runtime.guard.guardPermissionCall(runtime.read, DealService.method.markDealShipped, request, context.requestHeader);
      throw runtime.errors.unavailable();
    },
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
