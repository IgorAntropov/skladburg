import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  LogisticsService,
  SelectTransportOfferResponseSchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';

import type { IModuleRuntime } from '../moduleRuntime';

import {
  enforcePermissionAmountLimit,
  resolvePermissionGrants,
} from '../../access/index';
import { buildTransportSettlement } from '../payments/transportSettlement';
import { transportRequestAudience } from './transportAudience';
import { publishTransportChanges } from './transportEvents';
import {
  canCarryTransportRequest,
  isTransportDealParty,
} from './transportMatching';
import { projectTransportRequest } from './transportProjection';
import { buildTripRecord } from './tripRecords';

type SelectTransportOffer = ServiceImpl<typeof LogisticsService>['selectTransportOffer'];

export const selectTransportOffer = (
  runtime: IModuleRuntime,
  request: Parameters<SelectTransportOffer>[0],
  context: Parameters<SelectTransportOffer>[1],
): ReturnType<SelectTransportOffer> => {
  const { command, errors, guard, idempotency } = runtime;

  return command((transaction) => {
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
        if (record.status !== TransportRequestStatus.OPEN) {
          throw errors.invalidTransition(EntityKind.TRANSPORT_REQUEST, TransportRequestStatus[record.status], 'OPEN');
        }

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
        const now = transaction.worldTimeMs;
        if (!canCarryTransportRequest(transaction, record, offer.carrierOrganizationId, now)) {
          throw errors.validationFailed([{ fieldPath: 'transport_offer_id', ruleId: 'logistics.offer_unavailable' }]);
        }

        const deal = transaction.get('deals', record.dealId);
        const trip = buildTripRecord(transaction, record, offer);
        if (deal === undefined || trip === undefined) {
          throw errors.notFound(EntityKind.DEAL);
        }
        buildTransportSettlement(errors, deal, trip);

        const audience = transportRequestAudience(transaction, record);
        const next = {
          ...record,
          selectedOfferId: offer.id,
          status: TransportRequestStatus.SELECTED,
          version: record.version + 1,
        };
        transaction.put('transportRequests', next);
        transaction.put('trips', trip);
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
  });
};
