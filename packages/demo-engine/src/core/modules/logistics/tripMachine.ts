import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { TripRecord } from '@skladburg/contracts/logistics/v1/trip_records';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  TripStatus,
  TripTransitionSchema,
} from '@skladburg/contracts/logistics/v1/trip_records';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { createStateMachine } from '../../machine/index';

const target = (status: TripStatus): { status: TripStatus } => ({ status });

const transitions = {
  accept: { [TripStatus.ARRIVED]: target(TripStatus.DELIVERED) },
  arrive: { [TripStatus.IN_TRANSIT]: target(TripStatus.ARRIVED) },
  assign: {
    [TripStatus.ASSIGNED]: target(TripStatus.ASSIGNED),
    [TripStatus.CONFIRMED]: target(TripStatus.ASSIGNED),
  },
  cancel: {
    [TripStatus.ASSIGNED]: target(TripStatus.CANCELLED),
    [TripStatus.AWAITING_CONFIRMATION]: target(TripStatus.CANCELLED),
    [TripStatus.CONFIRMED]: target(TripStatus.CANCELLED),
  },
  close: { [TripStatus.DELIVERED]: target(TripStatus.CLOSED) },
  confirm: { [TripStatus.AWAITING_CONFIRMATION]: target(TripStatus.CONFIRMED) },
  depart: { [TripStatus.LOADED]: target(TripStatus.IN_TRANSIT) },
  load: { [TripStatus.ASSIGNED]: target(TripStatus.LOADED) },
};

export type TripCommand = keyof typeof transitions;

const tripMachine = createStateMachine<TripCommand, TripStatus, { status: TripStatus }>({
  entity: EntityKind.TRIP,
  intendedStatuses: {
    accept: TripStatus.DELIVERED,
    arrive: TripStatus.ARRIVED,
    assign: TripStatus.ASSIGNED,
    cancel: TripStatus.CANCELLED,
    close: TripStatus.CLOSED,
    confirm: TripStatus.CONFIRMED,
    depart: TripStatus.IN_TRANSIT,
    load: TripStatus.LOADED,
  },
  statusName: status => TripStatus[status],
  transitions,
});

export const requireTripTransition = tripMachine.requireTransition;

export const advanceTrip = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  trip: TripRecord,
  command: TripCommand,
  actorUserId = '',
  at: Timestamp = timestampFromMs(transaction.worldTimeMs),
): void => {
  const { status } = requireTripTransition(runtime.errors, command, trip, undefined);
  if (trip.version >= 2_147_483_647) {
    throw runtime.errors.unavailable();
  }
  trip.transitions.push(create(TripTransitionSchema, { actorUserId, at, from: trip.status, to: status }));
  trip.status = status;
  trip.version++;
  transaction.put('trips', trip);
};
