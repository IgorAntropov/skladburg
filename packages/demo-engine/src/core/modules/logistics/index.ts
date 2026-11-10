import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';
import type { Money } from '@skladburg/contracts/common/v1/money';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createFetchHandler } from '@connectrpc/connect/protocol';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  GetTransportRequestResponseSchema,
  ListTransportOffersResponseSchema,
  ListTransportRequestsResponseSchema,
  LogisticsService,
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
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { compareIds } from '../../state/index';
import { SUPPORTED_CURRENCY_CODE } from '../catalog/catalogRules';
import { paginate } from '../pagination';
import { publishTransportChanges } from './transportEvents';
import { canCarryTransportRequest } from './transportMatching';
import {
  projectTransportRequest,
  readOwnTransportOffer,
} from './transportProjection';

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

  const tripService = async (): Promise<ReturnType<typeof import('./tripService')['createTripService']>> =>
    (await import('./tripService')).createTripService(runtime);

  return {
    assignTrip: async (request, context) => (await tripService()).assignTrip(request, context),
    confirmTransportOrder: async (request, context) => (await tripService()).confirmTransportOrder(request, context),
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
    getTrip: async (request, context) => (await tripService()).getTrip(request, context),
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
    listTrips: async (request, context) => (await tripService()).listTrips(request, context),
    publishTransportRequest: async (request, context) =>
      (await import('./publishTransportRequest')).publishTransportRequest(runtime, request, context),
    selectTransportOffer: async (request, context) =>
      (await import('./selectTransportOffer')).selectTransportOffer(runtime, request, context),
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
