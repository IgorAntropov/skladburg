import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { createFetchHandler } from '@connectrpc/connect/protocol';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  GetTransportRequestResponseSchema,
  ListTransportOffersResponseSchema,
  ListTransportRequestsResponseSchema,
  LogisticsService,
  TransportOfferCandidateSchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { compareIds } from '../../state/index';
import { paginate } from '../pagination';
import { canCarryTransportRequest } from './transportMatching';
import { projectTransportRequest } from './transportProjection';

export const createLogisticsService = (runtime: IModuleRuntime): ServiceImpl<typeof LogisticsService> => {
  const { errors, getWorldTimeMs, guard, read } = runtime;

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
    submitTransportOffer: async (request, context) =>
      (await import('./submitTransportOffer')).submitTransportOffer(runtime, request, context),
  };
};

export const createLogisticsHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(LogisticsService, createLogisticsService(runtime));

  return createFetchHandler(createPathDispatcher(router.handlers));
};
