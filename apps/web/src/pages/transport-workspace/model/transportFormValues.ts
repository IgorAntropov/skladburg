import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { FormFieldIssueValue } from '@skladburg/contracts/forms';
import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';

import {
  timestampFromDate,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import { validateFormValues } from '@skladburg/contracts/forms';
import { SubmitTransportOfferRequestFormRules } from '@skladburg/contracts/forms/logistics/v1/logistics';

import { parseUtcDateTime } from '@/shared/lib/calendar-date';
import { parseDecimalToMinor } from '@/shared/lib/money';

export interface TransportOfferFormValue {
  amount: string;
}

export interface TripAssignmentFormValue {
  departureDate: string;
  departureTime: string;
  driverId: string;
  vehicleId: string;
}

const AMOUNT_FIELD = 'amount.amountMinor';

const OFFER_AMOUNT_RULES = {
  fields: {
    [AMOUNT_FIELD]: {
      ...SubmitTransportOfferRequestFormRules.fields[AMOUNT_FIELD],
      gt: 0n,
      hasPresence: true,
      isRequired: true,
      lte: 9_223_372_036_854_775_807n,
    },
  },
};

export const readOfferAmount = (amount: string): bigint | undefined => parseDecimalToMinor(amount, 100n);

export const validateOfferValues = ({ amount }: TransportOfferFormValue): FormFieldIssueValue[] => {
  const issues = validateFormValues(OFFER_AMOUNT_RULES, { [AMOUNT_FIELD]: readOfferAmount(amount) }, [AMOUNT_FIELD]);

  return issues.length === 0 ? [] : [{ field: 'amount', ruleId: 'transport.amount' }];
};

export const mapOfferViolation = (field: string): string => field.startsWith('amount.') ? 'amount' : field;

const MINUTE_MS = 60_000;

const formatDeparture = (departure: Timestamp | undefined, shouldRoundUp: boolean): string => {
  if (departure === undefined) {
    return '';
  }

  const instant = timestampMs(departure);
  const display = shouldRoundUp ? Math.ceil(instant / MINUTE_MS) * MINUTE_MS : instant;

  return new Date(display).toISOString();
};

export const toTripAssignmentFormValues = (trip: Trip): TripAssignmentFormValue => {
  const { ownAssignment, transportOrder } = trip;
  const departure = ownAssignment?.departureAt === undefined
    ? formatDeparture(transportOrder?.pickupWindow?.startsAt, true)
    : formatDeparture(ownAssignment.departureAt, false);

  return {
    departureDate: departure.slice(0, 10),
    departureTime: departure.slice(11, 16),
    driverId: ownAssignment?.driverId ?? '',
    vehicleId: ownAssignment?.vehicleId ?? '',
  };
};

export const validateAssignmentValues = ({ departureDate, departureTime }: TripAssignmentFormValue): FormFieldIssueValue[] => {
  const parsed = parseUtcDateTime(departureDate, departureTime);

  if (parsed.field === 'date') {
    return [{ field: 'departureDate', ruleId: 'transport.date' }];
  }
  if (parsed.field === 'time') {
    return [{ field: 'departureTime', ruleId: 'transport.time' }];
  }

  return [];
};

export const readAssignmentDeparture = (
  { departureDate, departureTime }: TripAssignmentFormValue,
  original: Timestamp | undefined,
): Timestamp | undefined => {
  const parsed = parseUtcDateTime(departureDate, departureTime);
  if (parsed.value === undefined) {
    return undefined;
  }

  const previous = formatDeparture(original, false);
  if (original !== undefined && departureDate === previous.slice(0, 10) && departureTime.trim() === previous.slice(11, 16)) {
    return original;
  }

  return timestampFromDate(parsed.value);
};

export const mapAssignmentViolation = (field: string): string => field === 'departure_at' ? 'departureTime' : field;
