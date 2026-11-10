import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { VehicleDetails } from '@skladburg/contracts/fleet/v1/fleet';
import type {
  TransportCargo,
  TransportRequestRecord,
  TransportWindow,
} from '@skladburg/contracts/logistics/v1/logistics_records';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { IStateReader } from '../../state/index';

import {
  addCalendarDays,
  compareCalendarDates,
  getIsoWeekday,
  getStartOfDayInstant,
  toCalendarDate,
} from '../../calendar/index';
import { isProfileVerified } from '../../visibility/index';

const NANOSECONDS_PER_MILLISECOND = 1_000_000n;
const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const NANOSECONDS_PER_MINUTE = 60n * NANOSECONDS_PER_SECOND;
const MIN_TIMESTAMP_SECONDS = -62_135_596_800n;
const MAX_TIMESTAMP_SECONDS = 253_402_300_799n;
const DAYS_PER_WEEK = 7;

interface TimeRangeValue {
  end: bigint;
  start: bigint;
}

const readNanoseconds = (timestamp: Timestamp | undefined): bigint | undefined => {
  if (timestamp === undefined || timestamp.seconds < MIN_TIMESTAMP_SECONDS || timestamp.seconds > MAX_TIMESTAMP_SECONDS
    || !Number.isInteger(timestamp.nanos) || timestamp.nanos < 0 || timestamp.nanos >= 1_000_000_000) {
    return undefined;
  }

  return timestamp.seconds * NANOSECONDS_PER_SECOND + BigInt(timestamp.nanos);
};

export const readTransportWindow = (window: Pick<TransportWindow, 'endsAt' | 'startsAt'> | undefined): TimeRangeValue | undefined => {
  const start = readNanoseconds(window?.startsAt);
  const end = readNanoseconds(window?.endsAt);

  return start !== undefined && end !== undefined && start < end ? { end, start } : undefined;
};

const later = (current: bigint, prev: bigint): bigint => current > prev ? current : prev;

const earlier = (current: bigint, prev: bigint): bigint => current < prev ? current : prev;

const worldNanoseconds = (nowMs: number): bigint => BigInt(Math.floor(nowMs)) * NANOSECONDS_PER_MILLISECOND;

export const findDepartureRange = (
  request: Pick<TransportRequestRecord, 'deliveryWindow' | 'driveMinutes' | 'pickupWindow'>,
  nowMs: number,
): TimeRangeValue | undefined => {
  const pickup = readTransportWindow(request.pickupWindow);
  const delivery = readTransportWindow(request.deliveryWindow);
  if (pickup === undefined || delivery === undefined) {
    return undefined;
  }

  const driveTime = BigInt(request.driveMinutes) * NANOSECONDS_PER_MINUTE;
  const start = later(later(pickup.start, delivery.start - driveTime), worldNanoseconds(nowMs));
  const end = earlier(pickup.end, delivery.end - driveTime);

  return start < end ? { end, start } : undefined;
};

const floorMilliseconds = (instant: bigint): number =>
  Number((instant < 0n ? instant - NANOSECONDS_PER_MILLISECOND + 1n : instant) / NANOSECONDS_PER_MILLISECOND);

const isWeekdayAvailable = (range: TimeRangeValue, weekdays: readonly number[], timeZone: string): boolean => {
  const localDate = toCalendarDate(floorMilliseconds(range.start), timeZone);
  if (weekdays.includes(getIsoWeekday(localDate))) {
    return true;
  }

  for (let offset = 1; offset <= DAYS_PER_WEEK; offset += 1) {
    const date = addCalendarDays(localDate, offset);
    if (weekdays.includes(getIsoWeekday(date))) {
      const firstInstant = BigInt(getStartOfDayInstant(date, timeZone)) * NANOSECONDS_PER_MILLISECOND;
      if (firstInstant >= range.end) {
        return false;
      }
      if (firstInstant >= range.start && compareCalendarDates(toCalendarDate(floorMilliseconds(firstInstant), timeZone), date) === 0) {
        return true;
      }
    }
  }

  return false;
};

const fitsCargo = (vehicle: VehicleDetails, cargo: TransportCargo): boolean =>
  cargo.bodyTypes.includes(vehicle.bodyType) && vehicle.cargoKinds.includes(cargo.cargoKind)
  && cargo.weightGrams <= vehicle.payloadGrams && cargo.volumeCubicCentimeters <= vehicle.volumeCubicCentimeters
  && cargo.lengthMillimeters <= vehicle.lengthMillimeters && cargo.widthMillimeters <= vehicle.widthMillimeters
  && cargo.heightMillimeters <= vehicle.heightMillimeters && cargo.palletPlaces <= vehicle.palletPlaces
  && (cargo.temperature === undefined || (vehicle.temperature !== undefined
    && vehicle.temperature.minCelsius <= cargo.temperature.maxCelsius && cargo.temperature.minCelsius <= vehicle.temperature.maxCelsius));

export const isTransportDealParty = (request: TransportRequestRecord, organizationId: string): boolean =>
  organizationId === request.customerOrganizationId || organizationId === request.supplierOrganizationId;

export const canCarryTransportRequest = (
  read: IStateReader,
  request: TransportRequestRecord,
  organizationId: string,
  nowMs: number,
): boolean => {
  const organization = read.get('organizations', organizationId);
  const origin = read.get('cities', request.fromCityId);
  const range = findDepartureRange(request, nowMs);
  const { cargo } = request;
  if (isTransportDealParty(request, organizationId) || organization === undefined || !isProfileVerified(organization, ProfileKind.CARRIER)
    || origin === undefined || range === undefined || cargo === undefined) {
    return false;
  }

  const lane = read.listBy('carrierLanes', 'tenantId', organizationId)
    .find(current => current.isActive && current.fromCityId === request.fromCityId && current.toCityId === request.toCityId);
  if (lane === undefined) {
    return false;
  }

  const driveTime = BigInt(request.driveMinutes) * NANOSECONDS_PER_MINUTE;
  return read.listBy('vehicles', 'tenantId', organizationId).some(({ details }) => details !== undefined && fitsCargo(details, cargo)
    && details.availability.some((window) => {
      const availability = readTransportWindow(window);
      if (window.cityId !== request.fromCityId || availability === undefined) {
        return false;
      }

      const start = later(range.start, availability.start);
      const end = earlier(range.end, availability.end - driveTime + 1n);

      return start < end && isWeekdayAvailable({ end, start }, lane.departureWeekdays, origin.timeZone);
    }));
};
