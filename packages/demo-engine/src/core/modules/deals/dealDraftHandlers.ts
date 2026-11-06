import type { ServiceImpl } from '@connectrpc/connect';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  CreateDealDraftResponseSchema,
  DealSchema,
  DealService,
  DealSource,
  DealStatus,
  UpdateDealDraftResponseSchema,
} from '@skladburg/contracts/deal/v1/deal';
import { DealChange } from '@skladburg/contracts/deal/v1/deal_events';

import type { IModuleRuntime } from '../moduleRuntime';

import { markImportedListingsUsed } from '../import/index';
import { requireDealPartyProfiles } from './dealAccess';
import {
  buildDraftLines,
  checkDealDate,
  quoteDealDelivery,
} from './dealCatalog';
import { runDealCommand } from './dealCommand';
import { publishDealEffects } from './dealEffects';
import {
  getOrCreateSupplyContract,
  linkDealProducts,
} from './dealProducts';
import { sumDealLines } from './dealRules';

export const createDealDraftHandlers = (runtime: IModuleRuntime): Pick<ServiceImpl<typeof DealService>,
  'createDealDraft' | 'updateDealDraft'> => ({
  createDealDraft: (request, context) => runtime.command((transaction) => {
    const caller = runtime.guard.guardPermissionCall(transaction, DealService.method.createDealDraft, request, context.requestHeader);
    if (caller.admission.kind !== 'membership') {
      throw runtime.errors.permissionDenied('deal_create');
    }
    return runtime.idempotency.run(transaction, {
      handler: () => {
        const existing = transaction.get('deals', request.dealId);
        if (existing !== undefined) {
          if (existing.customerOrganizationId !== caller.organizationId) {
            throw runtime.errors.notFound(EntityKind.DEAL);
          }
          throw runtime.errors.versionConflict(EntityKind.DEAL, existing.version);
        }
        if (request.expectedVersion !== 0) {
          throw runtime.errors.notFound(EntityKind.DEAL);
        }
        requireDealPartyProfiles(transaction, runtime.errors, request.supplierOrganizationId, caller.organizationId);
        const dealContext = { ...request, customerOrganizationId: caller.organizationId };
        checkDealDate(runtime, transaction, dealContext, request.desiredDate);
        const lines = buildDraftLines(runtime, transaction, dealContext, request.lines, []);
        const deliveryTotal = quoteDealDelivery(runtime, transaction, dealContext, lines);
        const goodsTotal = sumDealLines(runtime.errors, lines, deliveryTotal);
        linkDealProducts(runtime, transaction, caller.organizationId, request.supplierOrganizationId, lines);
        markImportedListingsUsed(transaction, request.supplierOrganizationId, lines.map(line => line.listingId));
        const contract = getOrCreateSupplyContract(runtime, transaction, request.supplierOrganizationId, caller.organizationId);
        const number = transaction.list('deals').reduce((max, deal) => Math.max(max, deal.number), 1000) + 1;
        if (number > 2_147_483_647) {
          throw runtime.errors.unavailable();
        }
        const at = timestampFromMs(runtime.getWorldTimeMs());
        const deal = create(DealSchema, {
          contractId: contract.id,
          createdAt: at,
          customerOrganizationId: caller.organizationId,
          deliveryTotal,
          desiredDate: request.desiredDate,
          goodsTotal,
          id: request.dealId,
          lines,
          number,
          shipFromCityId: request.shipFromCityId,
          shipToWarehouseId: request.shipToWarehouseId,
          source: DealSource.MANUAL,
          status: DealStatus.DRAFT,
          supplierOrganizationId: request.supplierOrganizationId,
          updatedAt: at,
          version: 1,
        });
        transaction.put('deals', deal);
        publishDealEffects(runtime, transaction, deal, undefined, DealChange.LINES, caller.organizationId);
        return create(CreateDealDraftResponseSchema, { deal });
      },
      idempotencyKey: request.idempotencyKey,
      method: DealService.method.createDealDraft,
      request,
      scope: caller.organizationId,
    });
  }),
  updateDealDraft: (request, context) => runDealCommand(runtime, {
    command: 'updateDealDraft',
    handle: (transaction, caller, deal) => {
      const next = clone(DealSchema, deal);
      next.shipFromCityId = request.shipFromCityId;
      next.shipToWarehouseId = request.shipToWarehouseId;
      next.desiredDate = request.desiredDate;
      checkDealDate(runtime, transaction, next, next.desiredDate);
      next.lines = buildDraftLines(runtime, transaction, next, request.lines, deal.lines);
      next.deliveryTotal = quoteDealDelivery(runtime, transaction, next, next.lines);
      next.goodsTotal = sumDealLines(runtime.errors, next.lines, next.deliveryTotal);
      linkDealProducts(runtime, transaction, caller.organizationId, deal.supplierOrganizationId, next.lines);
      markImportedListingsUsed(transaction, deal.supplierOrganizationId, next.lines.map(line => line.listingId));
      return next;
    },
    headers: context.requestHeader,
    method: DealService.method.updateDealDraft,
    notice: undefined,
    request,
    response: deal => create(UpdateDealDraftResponseSchema, { deal }),
  }),
});
