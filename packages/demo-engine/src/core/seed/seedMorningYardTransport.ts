import type { MessageInitShape } from '@bufbuild/protobuf';
import type { TransportCargoSchema } from '@skladburg/contracts/logistics/v1/logistics_records';

import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';
import { TripDocumentsService } from '@skladburg/contracts/logistics/v1/trip_documents';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';

import type { HistoryTransportContextValue } from './seedDealHistory';

import { DEMO_USER_HEADER } from '../protocol';

interface MorningYardTransportValue {
  arrivalMs: number;
  cargo: MessageInitShape<typeof TransportCargoSchema>;
  carrierOrganizationId: string;
  carrierUserId: string;
  departureMs: number;
  driverId: string;
  hasCarrierTitle: boolean;
  vehicleId: string;
}

const MINUTE_MS = 60_000;
export const MORNING_YARD_FREIGHT_MINOR = 750_000n;

const windowAround = (startsAtMs: number): {
  endsAt: ReturnType<typeof timestampFromMs>; startsAt: ReturnType<typeof timestampFromMs>;
} => ({
  endsAt: timestampFromMs(startsAtMs + 60 * MINUTE_MS),
  startsAt: timestampFromMs(startsAtMs),
});

export const prepareMorningYardTransport = async (
  { call, customerHeaders, deal, nextId }: HistoryTransportContextValue,
  route: MorningYardTransportValue,
): Promise<(() => Promise<void>) | undefined> => {
  const { method } = LogisticsService;
  const { transportRequest } = await call(method.publishTransportRequest, {
    cargo: route.cargo,
    dealId: deal.id,
    deliveryWindow: windowAround(route.arrivalMs),
    expectedVersion: deal.version,
    idempotencyKey: nextId(),
    pickupWindow: windowAround(route.departureMs),
  }, customerHeaders);
  const tripId = transportRequest?.summary?.id;
  if (tripId === undefined || transportRequest?.perspective.case !== 'deal') {
    throw new Error('The morning yard transport request was not published');
  }

  const carrierHeaders = { [ACTING_ORGANIZATION_HEADER]: route.carrierOrganizationId, [DEMO_USER_HEADER]: route.carrierUserId };
  const amount = { amountMinor: MORNING_YARD_FREIGHT_MINOR, currencyCode: 'RUB' };
  const { offer } = await call(method.submitTransportOffer, {
    amount, idempotencyKey: nextId(), transportRequestId: tripId,
  }, carrierHeaders);
  if (offer === undefined) {
    throw new Error('The morning yard carrier offer is missing');
  }
  await call(method.selectTransportOffer, {
    confirmedAmount: amount,
    expectedVersion: transportRequest.perspective.value.version,
    idempotencyKey: nextId(),
    transportOfferId: offer.id,
    transportRequestId: tripId,
  }, customerHeaders);
  const { trip: confirmed } = await call(method.confirmTransportOrder, {
    expectedVersion: 1, idempotencyKey: nextId(), tripId,
  }, carrierHeaders);
  if (confirmed === undefined) {
    throw new Error('The morning yard transport order was not confirmed');
  }
  await call(method.assignTrip, {
    departureAt: timestampFromMs(route.departureMs),
    driverId: route.driverId,
    expectedVersion: confirmed.version,
    idempotencyKey: nextId(),
    tripId,
    vehicleId: route.vehicleId,
  }, carrierHeaders);

  if (!route.hasCarrierTitle) {
    return undefined;
  }
  return async (): Promise<void> => {
    const { trip } = await call(method.getTrip, { tripId }, carrierHeaders);
    if (trip === undefined) {
      throw new Error('The morning yard trip did not arrive');
    }
    await call(TripDocumentsService.method.submitCarrierTitle, {
      expectedVersion: trip.version, idempotencyKey: nextId(), tripId,
    }, carrierHeaders);
  };
};
