import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { VehicleAvailability } from '@skladburg/contracts/fleet/v1/fleet';
import type { FormFieldIssueValue } from '@skladburg/contracts/forms';

import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { SaveVehicleRequestFormRules } from '@skladburg/contracts/forms/fleet/v1/fleet';

import { parseIsoCalendarDate } from '@/shared/lib/calendar-date';

export interface AvailabilityRowValue {
  cityId: string;
  endDate: string;
  endTime: string;
  sourceIndex: number;
  startDate: string;
  startTime: string;
}

interface AvailabilityBoundaryValue {
  date: string;
  time: string;
}

interface AvailabilityWindowValue {
  cityId: string;
  endsAt: Timestamp;
  startsAt: Timestamp;
}

type ReadAvailabilityValue
  = | { availability: AvailabilityWindowValue[]; issues: [] }
    | { availability?: undefined; issues: FormFieldIssueValue[] };

type ReadBoundaryValue
  = | { field: 'date' | 'time'; value?: undefined }
    | { field?: undefined; value: Timestamp };

export const VEHICLE_AVAILABILITY_CAPACITY = SaveVehicleRequestFormRules.fields['details.availability'].maxItems;

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const AVAILABILITY_PATH_PATTERN = /^details\.availability\[(\d+)\]\.(city_id|ends_at|starts_at)(?:\.|$)/;

const readDisplayBoundary = (timestamp: Timestamp | undefined): AvailabilityBoundaryValue => {
  if (timestamp === undefined) {
    return { date: '', time: '' };
  }

  const iso = new Date(Number(timestamp.seconds) * 1000).toISOString();

  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};

export const toAvailabilityRow = (window: undefined | VehicleAvailability, sourceIndex: number): AvailabilityRowValue => {
  const start = readDisplayBoundary(window?.startsAt);
  const end = readDisplayBoundary(window?.endsAt);

  return {
    cityId: window?.cityId ?? '',
    endDate: end.date,
    endTime: end.time,
    sourceIndex: window === undefined ? -1 : sourceIndex,
    startDate: start.date,
    startTime: start.time,
  };
};

const readBoundary = (date: string, rawTime: string, original: Timestamp | undefined): ReadBoundaryValue => {
  const parts = parseIsoCalendarDate(date);
  if (parts === undefined || parts.year < 1 || parts.year > 9999) {
    return { field: 'date' };
  }

  const calendarDay = new Date(0);
  calendarDay.setUTCFullYear(parts.year, parts.month - 1, parts.day);

  if (calendarDay.toISOString().slice(0, 10) !== date) {
    return { field: 'date' };
  }

  const time = rawTime.trim();

  if (!TIME_PATTERN.test(time)) {
    return { field: 'time' };
  }

  const previous = readDisplayBoundary(original);

  if (original !== undefined && date === previous.date && time === previous.time) {
    return { value: original };
  }

  calendarDay.setUTCHours(Number(time.slice(0, 2)), Number(time.slice(3)));

  return { value: timestampFromDate(calendarDay) };
};

export const readAvailabilityWindows = (
  rows: readonly AvailabilityRowValue[],
  windowOrder: readonly number[],
  originals: readonly VehicleAvailability[],
): ReadAvailabilityValue => {
  const availability: AvailabilityWindowValue[] = [];
  const issues: FormFieldIssueValue[] = [];

  for (const slot of windowOrder) {
    const row = rows[slot];

    if (row === undefined) {
      throw new Error('Vehicle availability row is missing');
    }

    const original = originals[row.sourceIndex];
    const start = readBoundary(row.startDate, row.startTime, original?.startsAt);
    const end = readBoundary(row.endDate, row.endTime, original?.endsAt);
    const path = `details.availability.${String(slot)}`;

    if (row.cityId === '') {
      issues.push({ field: `${path}.cityId`, ruleId: 'required' });
    }
    if (start.field !== undefined) {
      issues.push({
        field: start.field === 'date' ? `${path}.startDate` : `${path}.startTime`,
        ruleId: 'fleet.timestamp_invalid',
      });
    }
    if (end.field !== undefined) {
      issues.push({
        field: end.field === 'date' ? `${path}.endDate` : `${path}.endTime`,
        ruleId: 'fleet.timestamp_invalid',
      });
    }
    if (start.value !== undefined && end.value !== undefined) {
      availability.push({ cityId: row.cityId, endsAt: end.value, startsAt: start.value });
    }
  }

  return issues.length === 0 ? { availability, issues: [] } : { issues };
};

export const mapVehicleViolationPath = (fieldPath: string, windowOrder: readonly number[]): string => {
  if (fieldPath === 'details.temperature') {
    return 'details.temperature.minCelsius';
  }

  if (fieldPath === 'details.cargo_kinds' || fieldPath.startsWith('details.cargo_kinds[')) {
    return 'hasGeneralCargo';
  }

  const match = AVAILABILITY_PATH_PATTERN.exec(fieldPath);
  const slot = match === null ? undefined : windowOrder[Number(match[1])];

  if (match === null || slot === undefined) {
    return fieldPath;
  }

  const path = `details.availability.${String(slot)}`;

  switch (match[2]) {
    case 'city_id':
      return `${path}.cityId`;
    case 'ends_at':
      return `${path}.endTime`;
    case 'starts_at':
      return `${path}.startTime`;
    default:
      return fieldPath;
  }
};
