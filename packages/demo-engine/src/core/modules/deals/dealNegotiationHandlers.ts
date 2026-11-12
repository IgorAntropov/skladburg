import type { ServiceImpl } from '@connectrpc/connect';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  AcceptCounterOfferResponseSchema,
  ConfirmDealResponseSchema,
  CounterDealResponseSchema,
  CounterOfferSchema,
  DealSchema,
  DealService,
  SubmitDealResponseSchema,
} from '@skladburg/contracts/deal/v1/deal';
import { DealNotice } from '@skladburg/contracts/notification/v1/notification';

import type { IModuleRuntime } from '../moduleRuntime';
import type { reserveOutboundStock } from '../wms/outboundReservation';
import type { DealAvailabilityValue } from './dealCatalog';

import { checkDealApproval } from './dealAccess';
import {
  buildCounterLines,
  checkCurrentDealLines,
  checkDealDate,
} from './dealCatalog';
import { runDealCommand } from './dealCommand';
import { createDealDeadlines } from './dealDeadlines';
import {
  failDealValidation,
  sumDealLines,
} from './dealRules';

export const createDealNegotiationHandlers = (
  runtime: IModuleRuntime,
  availabilityFor: DealAvailabilityValue | undefined,
  reserveStock: typeof reserveOutboundStock | undefined,
): Pick<
  ServiceImpl<typeof DealService>, 'acceptCounterOffer' | 'confirmDeal' | 'counterDeal' | 'submitDeal'
> => ({
  acceptCounterOffer: (request, context) => runDealCommand(runtime, {
    command: 'acceptCounterOffer',
    handle: (transaction, caller, deal) => {
      const offer = deal.counterOffer;
      if (offer === undefined) {
        throw runtime.errors.internal();
      }
      checkDealApproval(transaction, runtime.errors, caller, offer.goodsTotal, request.goodsTotal);
      checkDealDate(runtime, transaction, deal, offer.desiredDate);
      checkCurrentDealLines(runtime, transaction, deal, offer.lines, offer.shipFromWarehouseId, availabilityFor);
      const next = clone(DealSchema, deal);
      next.lines = offer.lines;
      next.goodsTotal = offer.goodsTotal;
      next.desiredDate = offer.desiredDate;
      next.shipFromWarehouseId = offer.shipFromWarehouseId;
      next.counterOffer = undefined;
      next.deadlines = createDealDeadlines(runtime, transaction, next, 'clear');
      reserveStock?.(transaction, runtime, next, caller.organizationId === next.supplierOrganizationId ? caller.user.id : '');
      return next;
    },
    headers: context.requestHeader,
    method: DealService.method.acceptCounterOffer,
    notice: DealNotice.CONFIRMED,
    request,
    response: deal => create(AcceptCounterOfferResponseSchema, { deal }),
  }),
  confirmDeal: (request, context) => runDealCommand(runtime, {
    command: 'confirmDeal',
    handle: (transaction, caller, deal) => {
      checkDealApproval(transaction, runtime.errors, caller, deal.goodsTotal, request.goodsTotal);
      checkDealDate(runtime, transaction, deal, deal.desiredDate);
      checkCurrentDealLines(runtime, transaction, deal, deal.lines, request.shipFromWarehouseId, availabilityFor);
      const next = clone(DealSchema, deal);
      next.shipFromWarehouseId = request.shipFromWarehouseId;
      next.deadlines = createDealDeadlines(runtime, transaction, next, 'clear');
      reserveStock?.(transaction, runtime, next, caller.user.id);
      return next;
    },
    headers: context.requestHeader,
    method: DealService.method.confirmDeal,
    notice: DealNotice.CONFIRMED,
    request,
    response: deal => create(ConfirmDealResponseSchema, { deal }),
  }),
  counterDeal: (request, context) => runDealCommand(runtime, {
    command: 'counterDeal',
    handle: (transaction, _caller, deal) => {
      checkDealDate(runtime, transaction, deal, request.desiredDate);
      const lines = buildCounterLines(runtime, deal, request.lines);
      checkCurrentDealLines(runtime, transaction, deal, lines, request.shipFromWarehouseId, availabilityFor);
      const next = clone(DealSchema, deal);
      next.counterOffer = create(CounterOfferSchema, {
        desiredDate: request.desiredDate,
        goodsTotal: sumDealLines(runtime.errors, lines, deal.deliveryTotal),
        lines,
        reason: request.reason,
        shipFromWarehouseId: request.shipFromWarehouseId,
      });
      next.deadlines = createDealDeadlines(runtime, transaction, next, 'counterOffer');
      return next;
    },
    headers: context.requestHeader,
    method: DealService.method.counterDeal,
    notice: DealNotice.COUNTER_OFFERED,
    reason: request.reason,
    request,
    response: deal => create(CounterDealResponseSchema, { deal }),
  }),
  submitDeal: (request, context) => runDealCommand(runtime, {
    command: 'submitDeal',
    handle: (transaction, caller, deal) => {
      checkDealApproval(transaction, runtime.errors, caller, deal.goodsTotal, request.goodsTotal);
      checkDealDate(runtime, transaction, deal, deal.desiredDate);
      checkCurrentDealLines(runtime, transaction, deal, deal.lines, undefined, availabilityFor);
      const next = clone(DealSchema, deal);
      if (next.submittedAt !== undefined) {
        failDealValidation(runtime.errors, 'deal_id', 'deal.lines.mismatch');
      }
      next.submittedAt = timestampFromMs(runtime.getWorldTimeMs());
      next.deadlines = createDealDeadlines(runtime, transaction, next, 'confirmation');
      return next;
    },
    headers: context.requestHeader,
    method: DealService.method.submitDeal,
    notice: DealNotice.RECEIVED,
    request,
    response: deal => create(SubmitDealResponseSchema, { deal }),
  }),
});
