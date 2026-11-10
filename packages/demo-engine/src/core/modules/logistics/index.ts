import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';
import type { Money } from '@skladburg/contracts/common/v1/money';
import type { TransportRequestRecord } from '@skladburg/contracts/logistics/v1/logistics_records';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createFetchHandler } from '@connectrpc/connect/protocol';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  GetTransportRequestResponseSchema,
  ListTransportOffersResponseSchema,
  ListTransportRequestsResponseSchema,
  LogisticsService,
  SelectTransportOfferResponseSchema,
  SubmitTransportOfferResponseSchema,
  TransportOfferCandidateSchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import {
  TransportOfferSchema,
  TransportRequestStatus,
} from '@skladburg/contracts/logistics/v1/logistics_records';

import type { IDomainErrors } from '../../errors/index';
import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  enforcePermissionAmountLimit,
  resolvePermissionGrants,
} from '../../access/index';
import {
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { compareIds } from '../../state/index';
import { SUPPORTED_CURRENCY_CODE } from '../catalog/catalogRules';
import { paginate } from '../pagination';
import { publishTransportRequest } from './publishTransportRequest';
import {
  publishTransportChanges,
  transportRequestAudience,
} from './transportLifecycle';
import {
  canCarryTransportRequest,
  isTransportDealParty,
} from './transportMatching';
import {
  projectTransportRequest,
  readOwnTransportOffer,
} from './transportProjection';

const requireOpenRequest = (errors: IDomainErrors, request: TransportRequestRecord): void => {
  if (request.status !== TransportRequestStatus.OPEN) {
    throw errors.invalidTransition(EntityKind.TRANSPORT_REQUEST, TransportRequestStatus[request.status], 'OPEN');
  }
};

const requirePositiveAmount = (errors: IDomainErrors, amount: Money | undefined): Money => {
  if (amount === undefined) {
    throw errors.internal();
  }
  if (amount.amountMinor <= 0n) {
    throw errors.validationFailed([{ fieldPath: 'amount.amount_minor', ruleId: 'int64.gt' }]);
  }
  if (amount.currencyCode !== SUPPORTED_CURRENCY_CODE) {
    throw errors.validationFailed([{ fieldPath: 'amount.currency_code', ruleId: 'money.currency_unsupported' }]);
  }
  return amount;
};

export const createLogisticsService = (runtime: IModuleRuntime): ServiceImpl<typeof LogisticsService> => {
  const { command, errors, getWorldTimeMs, guard, idempotency, read } = runtime;

  return {
    getTransportRequest: (request, context) => {
      const method = LogisticsService.method.getTransportRequest;
      const { organizationId } = guard.guardPermissionCall(read, method, request, context.requestHeader);
      const record = read.get('transportRequests', request.transportRequestId);
      const view = record === undefined ? undefined : projectTransportRequest(read, record, organizationId, getWorldTimeMs());
      if (view === undefined) {
        throw errors.notFound(EntityKind.TRANSPORT_REQUEST);
      }

      return create(GetTransportRequestResponseSchema, { transportRequest: view });
    },
    listTransportOffers: (request, context) => {
      const method = LogisticsService.method.listTransportOffers;
      const { organizationId } = guard.guardPermissionCall(read, method, request, context.requestHeader);
      const record = read.get('transportRequests', request.transportRequestId);
      if (record?.shipperOrganizationId !== organizationId) {
        throw errors.notFound(EntityKind.TRANSPORT_REQUEST);
      }

      const now = getWorldTimeMs();
      const candidates = read.listBy('transportOffers', 'transportRequestId', record.id)
        .map(offer => ({
          isCompatible: record.status === TransportRequestStatus.OPEN
            && canCarryTransportRequest(read, record, offer.carrierOrganizationId, now),
          offer,
        }))
        .sort((current, prev) => {
          if (current.isCompatible !== prev.isCompatible) {
            return current.isCompatible ? -1 : 1;
          }
          const currentAmount = current.offer.amount?.amountMinor ?? 0n;
          const prevAmount = prev.offer.amount?.amountMinor ?? 0n;

          return currentAmount === prevAmount ? compareIds(current.offer.id, prev.offer.id) : currentAmount < prevAmount ? -1 : 1;
        });
      const { items, page } = paginate(candidates, candidate => candidate.offer.id, request.page, errors);

      return create(ListTransportOffersResponseSchema, {
        candidates: items.map(candidate => create(TransportOfferCandidateSchema, candidate)),
        page,
      });
    },
    listTransportRequests: (request, context) => {
      const method = LogisticsService.method.listTransportRequests;
      const { organizationId } = guard.guardPermissionCall(read, method, request, context.requestHeader);
      const now = getWorldTimeMs();
      const records = read.list('transportRequests').sort((current, prev) => compareIds(current.id, prev.id));
      const candidates = records.flatMap((record) => {
        const view = projectTransportRequest(read, record, organizationId, now);

        return view === undefined ? [] : [{ id: record.id, view }];
      });
      const { items, page } = paginate(candidates, candidate => candidate.id, request.page, errors);

      return create(ListTransportRequestsResponseSchema, { page, transportRequests: items.map(candidate => candidate.view) });
    },
    publishTransportRequest: (request, context) => publishTransportRequest(runtime, request, context),
    selectTransportOffer: (request, context) => command((transaction) => {
      const method = LogisticsService.method.selectTransportOffer;
      const caller = guard.guardPermissionCall(transaction, method, request, context.requestHeader);
      const { admission, organizationId } = caller;

      return idempotency.run(transaction, {
        handler: () => {
          const record = transaction.get('transportRequests', request.transportRequestId);
          if (record === undefined || !isTransportDealParty(record, organizationId)) {
            throw errors.notFound(EntityKind.TRANSPORT_REQUEST);
          }
          if (admission.kind !== 'membership' || record.shipperOrganizationId !== organizationId) {
            throw errors.permissionDenied('transport_offer_approve');
          }
          if (record.version !== request.expectedVersion) {
            throw errors.versionConflict(EntityKind.TRANSPORT_REQUEST, record.version);
          }
          requireOpenRequest(errors, record);

          const offer = transaction.get('transportOffers', request.transportOfferId);
          if (offer?.transportRequestId !== record.id || offer.amount === undefined) {
            throw errors.notFound(EntityKind.TRANSPORT_OFFER);
          }

          enforcePermissionAmountLimit(resolvePermissionGrants(transaction, admission.membership),
            'transport_offer_approve', offer.amount, errors);
          const { confirmedAmount } = request;
          if (offer.amount.amountMinor !== confirmedAmount?.amountMinor || offer.amount.currencyCode !== confirmedAmount.currencyCode) {
            throw errors.validationFailed([{ fieldPath: 'confirmed_amount', ruleId: 'logistics.amount_mismatch' }]);
          }
          const now = getWorldTimeMs();
          if (!canCarryTransportRequest(transaction, record, offer.carrierOrganizationId, now)) {
            throw errors.validationFailed([{ fieldPath: 'transport_offer_id', ruleId: 'logistics.offer_unavailable' }]);
          }

          const audience = transportRequestAudience(runtime, transaction, record);
          const next = {
            ...record,
            selectedOfferId: offer.id,
            status: TransportRequestStatus.SELECTED,
            version: record.version + 1,
          };
          transaction.put('transportRequests', next);
          publishTransportChanges(runtime, transaction, audience);

          return create(SelectTransportOfferResponseSchema, {
            transportRequest: projectTransportRequest(transaction, next, organizationId, now),
          });
        },
        idempotencyKey: request.idempotencyKey,
        method,
        request,
        scope: organizationId,
      });
    }),
    submitTransportOffer: (request, context) => command((transaction) => {
      const method = LogisticsService.method.submitTransportOffer;
      const { organizationId } = guard.guardPermissionCall(transaction, method, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const record = transaction.get('transportRequests', request.transportRequestId);
          const now = getWorldTimeMs();
          if (record?.status !== TransportRequestStatus.OPEN
            || !canCarryTransportRequest(transaction, record, organizationId, now)) {
            throw errors.notFound(EntityKind.TRANSPORT_REQUEST);
          }
          if (readOwnTransportOffer(transaction, record.id, organizationId) !== undefined) {
            throw errors.validationFailed([{ fieldPath: 'transport_request_id', ruleId: 'logistics.offer_exists' }]);
          }

          const offer = create(TransportOfferSchema, {
            amount: requirePositiveAmount(errors, request.amount),
            carrierOrganizationId: organizationId,
            id: runtime.random.uuid(),
            submittedAt: timestampFromMs(now),
            transportRequestId: record.id,
          });
          transaction.put('transportOffers', offer);
          publishTransportChanges(runtime, transaction, [organizationId, record.shipperOrganizationId]);

          return create(SubmitTransportOfferResponseSchema, { offer });
        },
        idempotencyKey: request.idempotencyKey,
        method,
        request,
        scope: organizationId,
      });
    }),
  };
};

export const createLogisticsHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(LogisticsService, createLogisticsService(runtime));

  return createFetchHandler(createPathDispatcher(router.handlers));
};
