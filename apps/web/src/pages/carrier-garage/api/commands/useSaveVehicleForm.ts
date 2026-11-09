import type { Vehicle } from '@skladburg/contracts/fleet/v1/fleet';
import type { FormFieldIssueValue } from '@skladburg/contracts/forms';

import { FleetService } from '@skladburg/contracts/fleet/v1/fleet';
import {
  SaveVehicleRequestFormRules,
  VehicleAvailabilityFormRules,
} from '@skladburg/contracts/forms/fleet/v1/fleet';
import { useState } from 'react';

import type {
  CommandFormValue,
  FormFieldPathValue,
} from '@/shared/lib/form';

import {
  createUuid,
  useApiClient,
} from '@/shared/api';
import {
  expandRepeatedFormRules,
  useCommandForm,
} from '@/shared/lib/form';

import type {
  VehicleFormInputValue,
  VehicleFormOutputValue,
} from '../../vehicle/vehicleFormValues';
import type { VehicleTranslate } from '../../vehicle/vehicleSection';

import {
  mapVehicleViolationPath,
  VEHICLE_AVAILABILITY_CAPACITY,
} from '../../vehicle/vehicleAvailability';
import {
  buildVehicleDetails,
  collectVehicleFormIssues,
  toVehicleFormValues,
} from '../../vehicle/vehicleFormValues';

interface SaveVehicleFormOptionsValue {
  onSaved: (saved: Vehicle) => void;
  t: VehicleTranslate;
  vehicle: undefined | Vehicle;
}

const RULES = expandRepeatedFormRules(
  SaveVehicleRequestFormRules,
  'details.availability',
  VehicleAvailabilityFormRules,
  VEHICLE_AVAILABILITY_CAPACITY,
);

const WATCHED_FIELDS: readonly FormFieldPathValue<VehicleFormInputValue>[] = ['windowOrder'];

type VehicleViolationMessageValue = Extract<Parameters<VehicleTranslate>[0], `garageVehicle.validation.${string}`>;

const VIOLATION_MESSAGES: Readonly<Partial<Record<string, VehicleViolationMessageValue>>> = {
  'fleet.availability_order': 'garageVehicle.validation.availabilityOrder',
  'fleet.availability_overlap': 'garageVehicle.validation.availabilityOverlap',
  'fleet.city_exists': 'garageVehicle.validation.city',
  'fleet.integer_overflow': 'garageVehicle.validation.integerOverflow',
  'fleet.registration_number_demo': 'garageVehicle.validation.demoNumber',
  'fleet.registration_number_taken': 'garageVehicle.validation.numberTaken',
  'fleet.temperature_range_order': 'garageVehicle.validation.temperatureOrder',
  'fleet.temperature_required': 'garageVehicle.validation.temperatureRequired',
  'fleet.timestamp_invalid': 'garageVehicle.validation.timestamp',
  'int32.gte_lte': 'garageVehicle.validation.temperatureRange',
  'repeated.min_items': 'garageVehicle.validation.cargoRequired',
};

export const useSaveVehicleForm = ({ onSaved, t, vehicle }: SaveVehicleFormOptionsValue): CommandFormValue<VehicleFormInputValue> => {
  const client = useApiClient();
  const [original] = useState(() => vehicle);
  const [vehicleId] = useState(() => original?.id ?? createUuid());
  const [defaultValues] = useState(() => toVehicleFormValues(original?.details));

  const execute = async (values: VehicleFormOutputValue, idempotencyKey: string): Promise<Vehicle> => {
    const response = await client.service(FleetService).saveVehicle({
      details: buildVehicleDetails(values, original?.details),
      expectedVersion: original?.version ?? 0n,
      idempotencyKey,
      vehicleId,
    });

    if (response.vehicle === undefined) {
      throw new Error('SaveVehicle response has no vehicle');
    }

    return response.vehicle;
  };

  const translateViolation = (ruleId: string): string | undefined => {
    const message = Object.hasOwn(VIOLATION_MESSAGES, ruleId) ? VIOLATION_MESSAGES[ruleId] : undefined;

    return message === undefined ? undefined : t(message);
  };

  const validateValues = (values: VehicleFormOutputValue): readonly FormFieldIssueValue[] =>
    collectVehicleFormIssues(values, original?.details);

  return useCommandForm<VehicleFormInputValue, Vehicle, VehicleFormOutputValue>({
    defaultValues,
    execute,
    mapViolationPath: (fieldPath, values) => mapVehicleViolationPath(fieldPath, values.windowOrder),
    method: FleetService.method.saveVehicle,
    onSuccess: onSaved,
    rules: RULES,
    translateViolation,
    validateValues,
    watchedFields: WATCHED_FIELDS,
  });
};
