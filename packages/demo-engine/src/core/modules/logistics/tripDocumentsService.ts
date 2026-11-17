import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createFetchHandler } from '@connectrpc/connect/protocol';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  SubmitCarrierTitleResponseSchema,
  TripDocumentsService,
} from '@skladburg/contracts/logistics/v1/trip_documents';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { refreshInboundYardAdmission } from '../wms/inboundRecords';
import { publishTripChanges } from './transportEvents';
import { readCarrierTrip } from './tripAccess';
import {
  advanceTrip,
  requireTripTransition,
} from './tripMachine';

export const createTripDocumentsService = (runtime: IModuleRuntime): ServiceImpl<typeof TripDocumentsService> => {
  const { command, errors, guard, idempotency } = runtime;
  const method = TripDocumentsService.method.submitCarrierTitle;

  return {
    submitCarrierTitle: (request, context) => command((transaction) => {
      const { admission, organizationId, user } = guard.guardPermissionCall(transaction, method, request, context.requestHeader);
      if (admission.kind !== 'membership') {
        throw errors.permissionDenied('trip_edit');
      }

      return idempotency.run(transaction, {
        handler: () => {
          const trip = readCarrierTrip(errors, transaction, request.tripId, organizationId);
          requireTripTransition(errors, 'submitCarrierTitle', trip, request.expectedVersion);
          if (trip.carrierTitle === undefined || trip.carrierTitle.submittedAt !== undefined) {
            throw errors.invalidTransition(EntityKind.TRIP, TripStatus[trip.status], method.name);
          }

          const at = timestampFromMs(transaction.worldTimeMs);
          trip.carrierTitle.submittedAt = at;
          trip.carrierTitle.submittedByUserId = user.id;
          advanceTrip(runtime, transaction, trip, 'submitCarrierTitle', user.id, at);
          refreshInboundYardAdmission(transaction, runtime, trip.dealId);
          publishTripChanges(runtime, transaction, trip);
          return create(SubmitCarrierTitleResponseSchema);
        },
        idempotencyKey: request.idempotencyKey,
        method,
        request,
        scope: organizationId,
      });
    }),
  };
};

export const createTripDocumentsHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(TripDocumentsService, createTripDocumentsService(runtime));

  return createFetchHandler(createPathDispatcher(router.handlers));
};
