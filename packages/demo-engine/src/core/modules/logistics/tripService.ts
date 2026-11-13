import type { ServiceImpl } from '@connectrpc/connect';
import type { TripRecord } from '@skladburg/contracts/logistics/v1/trip_records';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  AssignTripResponseSchema,
  ConfirmTransportOrderResponseSchema,
  GetTripResponseSchema,
  ListTripsResponseSchema,
  LogisticsService,
  type Trip,
  type TripReceiptDocuments,
  TripReceiptDocumentsSchema,
  TripSchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import { DealNotice } from '@skladburg/contracts/notification/v1/notification';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { ReadTripMapTrack } from './tripMapTrack';

import { isProfileVerified } from '../../visibility/index';
import { requireDealPartyProfiles } from '../deals/dealAccess';
import { advanceSystemDeal } from '../deals/dealEffects';
import { rub } from '../deals/dealRules';
import { loadDocuments } from '../documents/loadDocuments';
import { paginate } from '../pagination';
import {
  buildTransportSettlement,
  readCarrierTripPayment,
} from '../payments/transportSettlement';
import { publishTripChanges } from './transportEvents';
import {
  advanceTrip,
  requireTripTransition,
} from './tripMachine';
import { createTripMapTrackReader } from './tripMapTrack';
import { readTripBodyTemperature } from './tripTemperature';

type TripServiceValue = Pick<ServiceImpl<typeof LogisticsService>, 'assignTrip' | 'confirmTransportOrder' | 'getTrip' | 'listTrips'>;

const readReceiptDocuments = (read: IStateReader, dealId: string): TripReceiptDocuments | undefined => {
  const documents = read.listBy('documents', 'dealId', dealId).filter(document => document.displayNumber !== '');
  const dispatch = documents.find(document => document.content?.terms.case === 'dispatchTitle');
  const receipt = documents.find(document => document.content?.terms.case === 'receiptTitle' && document.signatures.length > 0);
  const act = documents.find(document => document.content?.terms.case === 'receiptDiscrepancyAct');
  const terms = dispatch?.content?.terms;
  if (dispatch === undefined && receipt === undefined && act === undefined) {
    return undefined;
  }

  return create(TripReceiptDocumentsSchema, {
    discrepancyActNumber: act?.displayNumber,
    dispatchedAt: terms?.case === 'dispatchTitle' ? terms.value.shippedAt : undefined,
    dispatchTitleNumber: dispatch?.displayNumber,
    receiptConfirmedAt: receipt?.signatures[0]?.signedAt,
    receiptTitleNumber: receipt?.displayNumber,
  });
};

const projectTrip = (
  read: IStateReader,
  trip: TripRecord,
  organizationId: string,
  worldTimeMs: number,
  readMapTrack?: ReadTripMapTrack,
): Trip | undefined => {
  const order = trip.transportOrder;
  if (order === undefined) {
    return undefined;
  }
  const isCarrier = order.carrierOrganizationId === organizationId;
  if (!isCarrier && organizationId !== trip.customerOrganizationId && organizationId !== trip.supplierOrganizationId) {
    return undefined;
  }

  return create(TripSchema, {
    arrivedAt: trip.arrivedAt,
    bodyTemperature: readTripBodyTemperature(trip, worldTimeMs),
    carrierPayment: isCarrier ? readCarrierTripPayment(read, trip) : undefined,
    dealId: trip.dealId,
    delivery: order.delivery,
    departedAt: trip.departedAt,
    id: trip.id,
    mapTrack: readMapTrack?.(order, trip.assignment),
    ownAssignment: isCarrier ? trip.assignment : undefined,
    pickup: order.pickup,
    plannedArrivalAt: trip.assignment?.arrivalAt,
    plannedDepartureAt: trip.assignment?.departureAt,
    receiptDocuments: readReceiptDocuments(read, trip.dealId),
    status: trip.status,
    transportOrder: isCarrier || order.shipperOrganizationId === organizationId
      ? { ...order, confirmedByUserId: isCarrier ? order.confirmedByUserId : '' }
      : undefined,
    version: trip.version,
  });
};

const readCarrierTrip = (
  errors: IDomainErrors,
  read: IStateReader,
  tripId: string,
  organizationId: string,
): TripRecord => {
  const trip = read.get('trips', tripId);
  const organization = read.get('organizations', organizationId);
  if (trip?.transportOrder?.carrierOrganizationId !== organizationId
    || organization === undefined || !isProfileVerified(organization, ProfileKind.CARRIER)) {
    throw errors.notFound(EntityKind.TRIP);
  }

  return trip;
};

export const createTripService = (runtime: IModuleRuntime): TripServiceValue => {
  const { command, errors, getWorldTimeMs, guard, idempotency, read } = runtime;

  return {
    assignTrip: async (request, context) => {
      const { buildTripAssignment } = await import('./tripAssignment');

      return command((transaction) => {
        const method = LogisticsService.method.assignTrip;
        const { admission, organizationId, user } = guard.guardPermissionCall(transaction, method, request, context.requestHeader);
        if (admission.kind !== 'membership') {
          throw errors.permissionDenied('trip_edit');
        }

        return idempotency.run(transaction, {
          handler: () => {
            const trip = readCarrierTrip(errors, transaction, request.tripId, organizationId);
            requireTripTransition(errors, 'assign', trip, request.expectedVersion);
            trip.assignment = buildTripAssignment(errors, transaction, trip, request);
            advanceTrip(runtime, transaction, trip, 'assign', user.id);
            publishTripChanges(runtime, transaction, trip);

            return create(AssignTripResponseSchema, { trip: projectTrip(transaction, trip, organizationId, transaction.worldTimeMs) });
          },
          idempotencyKey: request.idempotencyKey,
          method,
          request,
          scope: organizationId,
        });
      });
    },
    confirmTransportOrder: async (request, context) => {
      const { issueDealDocuments } = await loadDocuments();

      return command((transaction) => {
        const method = LogisticsService.method.confirmTransportOrder;
        const { admission, organizationId, user } = guard.guardPermissionCall(transaction, method, request, context.requestHeader);
        if (admission.kind !== 'membership') {
          throw errors.permissionDenied('trip_edit');
        }

        return idempotency.run(transaction, {
          handler: () => {
            const trip = readCarrierTrip(errors, transaction, request.tripId, organizationId);
            requireTripTransition(errors, 'confirm', trip, request.expectedVersion);
            const deal = transaction.get('deals', trip.dealId);
            if (deal === undefined || trip.transportOrder === undefined) {
              throw errors.internal();
            }
            requireDealPartyProfiles(transaction, errors, deal.supplierOrganizationId, deal.customerOrganizationId);
            buildTransportSettlement(errors, deal, trip);
            deal.deliveryTotal = rub(0n);
            advanceSystemDeal(runtime, transaction, deal, 'confirmTransportOrder', DealNotice.DOCUMENTS_READY, deal.supplierOrganizationId);
            issueDealDocuments(runtime, transaction, deal);
            trip.transportOrder.confirmedAt = timestampFromMs(transaction.worldTimeMs);
            trip.transportOrder.confirmedByUserId = user.id;
            advanceTrip(runtime, transaction, trip, 'confirm', user.id);
            publishTripChanges(runtime, transaction, trip);

            return create(ConfirmTransportOrderResponseSchema, {
              trip: projectTrip(transaction, trip, organizationId, transaction.worldTimeMs),
            });
          },
          idempotencyKey: request.idempotencyKey,
          method,
          request,
          scope: organizationId,
        });
      });
    },
    getTrip: (request, context) => {
      const method = LogisticsService.method.getTrip;
      const { organizationId } = guard.guardPermissionCall(read, method, request, context.requestHeader);
      const record = read.get('trips', request.tripId);
      const trip = record === undefined
        ? undefined
        : projectTrip(read, record, organizationId, getWorldTimeMs(), createTripMapTrackReader(read));
      if (trip === undefined) {
        throw errors.notFound(EntityKind.TRIP);
      }

      return create(GetTripResponseSchema, { trip });
    },
    listTrips: (request, context) => {
      const method = LogisticsService.method.listTrips;
      const { organizationId } = guard.guardPermissionCall(read, method, request, context.requestHeader);
      const worldTimeMs = getWorldTimeMs();
      const readMapTrack = createTripMapTrackReader(read);
      const candidates = read.list('trips').flatMap((record) => {
        const trip = projectTrip(read, record, organizationId, worldTimeMs, readMapTrack);

        return trip === undefined ? [] : [trip];
      });
      const { items, page } = paginate(candidates, trip => trip.id, request.page, errors);

      return create(ListTripsResponseSchema, { page, trips: items });
    },
  };
};
