import type { AssignTripRequest } from '@skladburg/contracts/logistics/v1/logistics';
import type { TripRecord } from '@skladburg/contracts/logistics/v1/trip_records';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  type TripAssignment,
  TripAssignmentSchema,
  TripStatus,
} from '@skladburg/contracts/logistics/v1/trip_records';

import type { IDomainErrors } from '../../errors/index';
import type { IStateTransaction } from '../../state/index';

import {
  canUseVehicleForTransportRequest,
  readNanoseconds,
} from './transportMatching';

const SECONDS_PER_MINUTE = 60n;

const isActiveReservation = (trip: TripRecord): boolean =>
  trip.status === TripStatus.ASSIGNED || trip.status === TripStatus.LOADED || trip.status === TripStatus.IN_TRANSIT;

const overlapsAssignment = (trip: TripRecord, start: bigint, end: bigint, tripId: string): boolean => {
  if (trip.id === tripId || !isActiveReservation(trip)) {
    return false;
  }
  const reservedStart = readNanoseconds(trip.assignment?.departureAt);
  const reservedEnd = readNanoseconds(trip.assignment?.arrivalAt);

  return reservedStart !== undefined && reservedEnd !== undefined && reservedStart < end && start < reservedEnd;
};

export const buildTripAssignment = (
  errors: IDomainErrors,
  transaction: IStateTransaction,
  trip: TripRecord,
  request: Pick<AssignTripRequest, 'departureAt' | 'driverId' | 'vehicleId'>,
): TripAssignment => {
  const { departureAt, driverId, vehicleId } = request;
  const carrierId = trip.transportOrder?.carrierOrganizationId;
  const driver = transaction.get('drivers', driverId);
  const vehicle = transaction.get('vehicles', vehicleId);
  if (carrierId === undefined || vehicle?.tenantId !== carrierId) {
    throw errors.notFound(EntityKind.VEHICLE);
  }
  if (driver?.tenantId !== carrierId) {
    throw errors.notFound(EntityKind.DRIVER);
  }
  if (!driver.isActive) {
    throw errors.validationFailed([{ fieldPath: 'driver_id', ruleId: 'logistics.driver_unavailable' }]);
  }

  const transport = transaction.get('transportRequests', trip.id);
  const arrivalAt = departureAt === undefined
    ? undefined
    : { ...departureAt, seconds: departureAt.seconds + BigInt(trip.driveMinutes) * SECONDS_PER_MINUTE };
  const start = readNanoseconds(departureAt);
  const end = readNanoseconds(arrivalAt);
  if (departureAt === undefined || transport === undefined || start === undefined || end === undefined
    || !canUseVehicleForTransportRequest(transaction, transport, carrierId, transaction.worldTimeMs, { departureAt, vehicleId })) {
    throw errors.validationFailed([{ fieldPath: 'departure_at', ruleId: 'logistics.departure_unavailable' }]);
  }
  if (transaction.listBy('trips', 'vehicleId', vehicleId).some(other => overlapsAssignment(other, start, end, trip.id))) {
    throw errors.validationFailed([{ fieldPath: 'vehicle_id', ruleId: 'logistics.vehicle_reserved' }]);
  }
  if (transaction.listBy('trips', 'driverId', driverId).some(other => overlapsAssignment(other, start, end, trip.id))) {
    throw errors.validationFailed([{ fieldPath: 'driver_id', ruleId: 'logistics.driver_reserved' }]);
  }

  return create(TripAssignmentSchema, {
    arrivalAt, departureAt, driverId, registrationNumber: vehicle.details?.registrationNumber, vehicleId,
  });
};
