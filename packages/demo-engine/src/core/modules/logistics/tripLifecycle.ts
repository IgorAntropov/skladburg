import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { TripRecord } from '@skladburg/contracts/logistics/v1/trip_records';

import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { TripCommand } from './tripMachine';

import { publishTripChanges } from './transportEvents';
import { advanceTrip } from './tripMachine';
import { readTripForDeal } from './tripRecords';

export {
  buildTripRecord,
  readTripForDeal,
} from './tripRecords';

interface TripDeliveryProgressValue {
  arrivedAtMs: number | undefined;
  hasDeparted: boolean;
}

export const ceilTimestampMs = (value: Timestamp): number => Number(value.seconds) * 1000 + Math.ceil(value.nanos / 1_000_000);

export const requireDealTrip = (runtime: IModuleRuntime, transaction: IStateTransaction, dealId: string): TripRecord => {
  const trip = readTripForDeal(transaction, dealId);
  if (trip === undefined) {
    throw runtime.errors.notFound(EntityKind.TRIP);
  }

  return trip;
};

export const advanceTripDelivery = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
): TripDeliveryProgressValue => {
  const trip = requireDealTrip(runtime, transaction, deal.id);
  const { arrivalAt, departureAt } = trip.assignment ?? {};
  if (arrivalAt === undefined || departureAt === undefined) {
    throw runtime.errors.internal();
  }

  const hasDeparted = trip.status === TripStatus.LOADED && ceilTimestampMs(departureAt) <= transaction.worldTimeMs;
  if (hasDeparted) {
    trip.departedAt = departureAt;
    advanceTrip(runtime, transaction, trip, 'depart', '', departureAt);
  }

  const arrival = ceilTimestampMs(arrivalAt);
  const arrivedAtMs = trip.status === TripStatus.IN_TRANSIT && arrival <= transaction.worldTimeMs ? arrival : undefined;
  if (arrivedAtMs !== undefined) {
    trip.arrivedAt = arrivalAt;
    advanceTrip(runtime, transaction, trip, 'arrive', '', arrivalAt);
  }

  if (hasDeparted || arrivedAtMs !== undefined) {
    publishTripChanges(runtime, transaction, trip);
  }

  return { arrivedAtMs, hasDeparted };
};

const advanceDealTrip = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
  command: TripCommand,
): void => {
  const trip = requireDealTrip(runtime, transaction, deal.id);
  advanceTrip(runtime, transaction, trip, command);
  publishTripChanges(runtime, transaction, trip);
};

export const markTripAccepted = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): void => {
  advanceDealTrip(runtime, transaction, deal, 'accept');
};

export const markTripPaid = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): void => {
  advanceDealTrip(runtime, transaction, deal, 'close');
};
