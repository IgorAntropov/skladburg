import type { Timestamp } from '@bufbuild/protobuf/wkt';

import {
  type SaveCarrierLaneRequest,
  VehicleCargoKind,
  type VehicleDetails,
} from '@skladburg/contracts/fleet/v1/fleet';

import type { ViolationValue } from '../../errors/index';
import type { IStateReader } from '../../state/index';

import {
  CURRENCY_UNSUPPORTED_RULE_ID,
  SUPPORTED_CURRENCY_CODE,
} from '../catalog/catalogRules';

const DEMO_REGISTRATION_PATTERN = /^[АВЕКМНОРСТУХ][0-9]{3}[АВЕКМНОРСТУХ]{2} 000$/u;
const MIN_TIMESTAMP_SECONDS = -62_135_596_800n;
const MAX_TIMESTAMP_SECONDS = 253_402_300_799n;
const MAX_TIMESTAMP_NANOS = 999_999_999;

interface AvailabilityRangeValue {
  endsAt: Timestamp;
  index: number;
  startsAt: Timestamp;
}

const availabilityPath = (index: number, field: string): string => `details.availability[${String(index)}].${field}`;

const isValidTimestamp = ({ nanos, seconds }: Timestamp): boolean =>
  seconds >= MIN_TIMESTAMP_SECONDS && seconds <= MAX_TIMESTAMP_SECONDS
  && Number.isInteger(nanos) && nanos >= 0 && nanos <= MAX_TIMESTAMP_NANOS;

const compareTimestamps = (current: Timestamp, previous: Timestamp): number => {
  if (current.seconds === previous.seconds) {
    return current.nanos - previous.nanos;
  }

  return current.seconds < previous.seconds ? -1 : 1;
};

const collectAvailabilityViolations = (read: IStateReader, details: VehicleDetails): ViolationValue[] => {
  const violations: ViolationValue[] = [];
  const ranges: AvailabilityRangeValue[] = [];

  for (const [index, window] of details.availability.entries()) {
    if (read.get('cities', window.cityId) === undefined) {
      violations.push({ fieldPath: availabilityPath(index, 'city_id'), ruleId: 'fleet.city_exists' });
    }

    const { endsAt, startsAt } = window;
    if (startsAt === undefined || endsAt === undefined) {
      continue;
    }

    const isStartValid = isValidTimestamp(startsAt);
    const isEndValid = isValidTimestamp(endsAt);
    if (!isStartValid) {
      violations.push({ fieldPath: availabilityPath(index, 'starts_at'), ruleId: 'fleet.timestamp_invalid' });
    }
    if (!isEndValid) {
      violations.push({ fieldPath: availabilityPath(index, 'ends_at'), ruleId: 'fleet.timestamp_invalid' });
    }
    if (!isStartValid || !isEndValid) {
      continue;
    }

    if (compareTimestamps(startsAt, endsAt) >= 0) {
      violations.push({ fieldPath: availabilityPath(index, 'ends_at'), ruleId: 'fleet.availability_order' });

      continue;
    }

    ranges.push({ endsAt, index, startsAt });
  }

  ranges.sort((current, previous) => compareTimestamps(current.startsAt, previous.startsAt));
  let latestEnd: Timestamp | undefined;
  for (const range of ranges) {
    if (latestEnd !== undefined && compareTimestamps(range.startsAt, latestEnd) < 0) {
      violations.push({ fieldPath: availabilityPath(range.index, 'starts_at'), ruleId: 'fleet.availability_overlap' });
    }
    if (latestEnd === undefined || compareTimestamps(range.endsAt, latestEnd) > 0) {
      latestEnd = range.endsAt;
    }
  }

  return violations;
};

export const normalizeRegistrationNumber = (value: string): string => {
  const compact = value.replace(/\s/gu, '').toUpperCase();

  return `${compact.slice(0, 6)} ${compact.slice(6)}`;
};

export const collectVehicleViolations = (
  read: IStateReader,
  organizationId: string,
  vehicleId: string,
  details: VehicleDetails,
): ViolationValue[] => {
  const violations = collectAvailabilityViolations(read, details);
  const { cargoKinds, registrationNumber, temperature } = details;

  if (!DEMO_REGISTRATION_PATTERN.test(registrationNumber)) {
    violations.push({ fieldPath: 'details.registration_number', ruleId: 'fleet.registration_number_demo' });
  }
  else if (read.listBy('vehicles', 'tenantId', organizationId)
    .some(vehicle => vehicle.id !== vehicleId && vehicle.details?.registrationNumber === registrationNumber)) {
    violations.push({ fieldPath: 'details.registration_number', ruleId: 'fleet.registration_number_taken' });
  }

  if (temperature === undefined && cargoKinds.includes(VehicleCargoKind.TEMPERATURE_CONTROLLED)) {
    violations.push({ fieldPath: 'details.temperature', ruleId: 'fleet.temperature_required' });
  }
  if (temperature !== undefined && temperature.minCelsius > temperature.maxCelsius) {
    violations.push({ fieldPath: 'details.temperature.max_celsius', ruleId: 'fleet.temperature_range_order' });
  }

  return violations;
};

export const collectCarrierLaneViolations = (
  read: IStateReader,
  organizationId: string,
  request: SaveCarrierLaneRequest,
): ViolationValue[] => {
  const violations: ViolationValue[] = [];
  const { carrierLaneId, fromCityId, tariff, toCityId } = request;

  if (read.get('cities', fromCityId) === undefined) {
    violations.push({ fieldPath: 'from_city_id', ruleId: 'fleet.city_exists' });
  }
  if (read.get('cities', toCityId) === undefined) {
    violations.push({ fieldPath: 'to_city_id', ruleId: 'fleet.city_exists' });
  }
  if (tariff !== undefined && tariff.currencyCode !== SUPPORTED_CURRENCY_CODE) {
    violations.push({ fieldPath: 'tariff.currency_code', ruleId: CURRENCY_UNSUPPORTED_RULE_ID });
  }
  if (read.listBy('carrierLanes', 'tenantId', organizationId)
    .some(lane => lane.id !== carrierLaneId && lane.fromCityId === fromCityId && lane.toCityId === toCityId)) {
    violations.push({ fieldPath: 'to_city_id', ruleId: 'fleet.carrier_lane_taken' });
  }

  return violations;
};
