import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';

import {
  AssignTripRequestFormRules,
  SubmitTransportOfferRequestFormRules,
} from '@skladburg/contracts/forms/logistics/v1/logistics';
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';
import { RUB_CURRENCY_CODE } from '@/shared/lib/money';

import type { TransportTranslate } from '../i18n/transportSection';
import type {
  TransportOfferFormValue,
  TripAssignmentFormValue,
} from '../model/transportFormValues';

import {
  mapAssignmentViolation,
  mapOfferViolation,
  readAssignmentDeparture,
  readOfferAmount,
  toTripAssignmentFormValues,
  validateAssignmentValues,
  validateOfferValues,
} from '../model/transportFormValues';

type TransportValidationKey = Extract<Parameters<TransportTranslate>[0], `transport.validation.${string}`>;

const assignmentMessages = new Map<string, TransportValidationKey>([
  ['logistics.departure_unavailable', 'transport.validation.departure'],
  ['logistics.driver_reserved', 'transport.validation.driverReserved'],
  ['logistics.driver_unavailable', 'transport.validation.driver'],
  ['logistics.vehicle_reserved', 'transport.validation.vehicleReserved'],
  ['transport.date', 'transport.validation.date'],
  ['transport.time', 'transport.validation.time'],
]);

export const useSubmitOfferForm = (
  requestId: string,
  onSuccess: () => void,
  t: TransportTranslate,
): CommandFormValue<TransportOfferFormValue> => {
  const client = useApiClient();

  return useCommandForm({
    defaultValues: { amount: '' },
    execute: ({ amount }, idempotencyKey) => {
      const amountMinor = readOfferAmount(amount);
      if (amountMinor === undefined) {
        throw new Error('The offer amount is invalid');
      }

      return client.service(LogisticsService).submitTransportOffer({
        amount: { amountMinor, currencyCode: RUB_CURRENCY_CODE },
        idempotencyKey,
        transportRequestId: requestId,
      });
    },
    mapViolationPath: mapOfferViolation,
    method: LogisticsService.method.submitTransportOffer,
    onSuccess,
    rules: SubmitTransportOfferRequestFormRules,
    translateViolation: ruleId => ruleId === 'transport.amount' ? t('transport.validation.amount') : undefined,
    validateValues: validateOfferValues,
  });
};

export const useAssignTripForm = (trip: Trip, onSuccess: () => void, t: TransportTranslate): CommandFormValue<TripAssignmentFormValue> => {
  const client = useApiClient();

  return useCommandForm({
    defaultValues: toTripAssignmentFormValues(trip),
    execute: (values, idempotencyKey) => {
      const departureAt = readAssignmentDeparture(values, trip.ownAssignment?.departureAt);
      if (departureAt === undefined) {
        throw new Error('The planned departure is invalid');
      }

      return client.service(LogisticsService).assignTrip({
        departureAt,
        driverId: values.driverId,
        expectedVersion: trip.version,
        idempotencyKey,
        tripId: trip.id,
        vehicleId: values.vehicleId,
      });
    },
    mapViolationPath: mapAssignmentViolation,
    method: LogisticsService.method.assignTrip,
    onSuccess,
    rules: AssignTripRequestFormRules,
    translateViolation: (ruleId) => {
      const key = assignmentMessages.get(ruleId);

      return key === undefined ? undefined : t(key);
    },
    validateValues: validateAssignmentValues,
  });
};
