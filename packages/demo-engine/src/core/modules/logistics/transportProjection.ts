import type { TransportRequestRecord } from '@skladburg/contracts/logistics/v1/logistics_records';

import { create } from '@bufbuild/protobuf';
import {
  CarrierTransportRequestSchema,
  DealTransportRequestSchema,
  type TransportRequest,
  TransportRequestSchema,
  TransportRequestSummarySchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';

import type { IStateReader } from '../../state/index';

import {
  canCarryTransportRequest,
  isTransportDealParty,
} from './transportMatching';
import { readOwnTransportOffer } from './transportOfferRecords';

export const projectTransportRequest = (
  read: IStateReader,
  request: TransportRequestRecord,
  organizationId: string,
  nowMs: number,
): TransportRequest | undefined => {
  const selected = read.get('transportOffers', request.selectedOfferId);
  const summary = create(TransportRequestSummarySchema, {
    cargo: request.cargo,
    deliveryWindow: request.deliveryWindow,
    fromCityId: request.fromCityId,
    id: request.id,
    pickupWindow: request.pickupWindow,
    publishedAt: request.publishedAt,
    status: request.status,
    toCityId: request.toCityId,
  });

  if (isTransportDealParty(request, organizationId)) {
    return create(TransportRequestSchema, { perspective: {
      case: 'deal',
      value: create(DealTransportRequestSchema, {
        dealId: request.dealId,
        selectedCarrierOrganizationId: selected?.carrierOrganizationId,
        selectedOffer: request.shipperOrganizationId === organizationId ? selected : undefined,
        shipperOrganizationId: request.shipperOrganizationId,
        version: request.version,
      }),
    }, summary });
  }

  const ownOffer = request.status === TransportRequestStatus.OPEN
    ? readOwnTransportOffer(read, request.id, organizationId)
    : selected?.carrierOrganizationId === organizationId ? selected : undefined;
  if (request.status === TransportRequestStatus.OPEN
    ? !canCarryTransportRequest(read, request, organizationId, nowMs)
    : ownOffer === undefined) {
    return undefined;
  }

  return create(TransportRequestSchema, { perspective: {
    case: 'carrier',
    value: create(CarrierTransportRequestSchema, { ownOffer }),
  }, summary });
};
