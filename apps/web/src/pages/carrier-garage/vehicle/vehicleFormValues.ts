import type { MessageInitShape } from '@bufbuild/protobuf';
import type {
  VehicleDetails,
  VehicleDetailsSchema,
} from '@skladburg/contracts/fleet/v1/fleet';
import type { FormFieldIssueValue } from '@skladburg/contracts/forms';

import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { validateFormValues } from '@skladburg/contracts/forms';
import { SaveVehicleRequestFormRules } from '@skladburg/contracts/forms/fleet/v1/fleet';

import type { AvailabilityRowValue } from './vehicleAvailability';

import {
  readAvailabilityWindows,
  toAvailabilityRow,
  VEHICLE_AVAILABILITY_CAPACITY,
} from './vehicleAvailability';

export interface VehicleFormInputValue extends VehicleCargoSelectionValue {
  details: VehicleDetailsInputValue;
  windowOrder: number[];
}

export interface VehicleFormOutputValue extends VehicleCargoSelectionValue {
  details: VehicleDetailsOutputValue;
  windowOrder: number[];
}

interface VehicleCargoSelectionValue {
  hasGeneralCargo: boolean;
  hasOversizeCargo: boolean;
  hasTemperatureControlledCargo: boolean;
}

interface VehicleDetailsInputValue {
  availability: AvailabilityRowValue[];
  bodyType: string;
  heightMillimeters: string;
  lengthMillimeters: string;
  palletPlaces: string;
  payloadGrams: string;
  registrationNumber: string;
  temperature: { maxCelsius: string; minCelsius: string };
  volumeCubicCentimeters: string;
  widthMillimeters: string;
}

interface VehicleDetailsOutputValue extends Omit<
  VehicleDetails,
  '$typeName' | '$unknown' | 'availability' | 'cargoKinds' | 'palletPlaces' | 'temperature'
> {
  availability: AvailabilityRowValue[];
  palletPlaces: number | undefined;
  temperature: { maxCelsius: number | undefined; minCelsius: number | undefined };
}

const INT32_MAX = 2_147_483_647;
const INT64_MAX = 9_223_372_036_854_775_807n;

const INT32_FIELDS = ['heightMillimeters', 'lengthMillimeters', 'palletPlaces', 'widthMillimeters'] as const;

const INT64_FIELDS = ['payloadGrams', 'volumeCubicCentimeters'] as const;

const CARGO_SELECTION = [
  ['hasGeneralCargo', VehicleCargoKind.GENERAL],
  ['hasTemperatureControlledCargo', VehicleCargoKind.TEMPERATURE_CONTROLLED],
  ['hasOversizeCargo', VehicleCargoKind.OVERSIZE],
] as const satisfies readonly (readonly [keyof VehicleCargoSelectionValue, VehicleCargoKind])[];

const getSelectedCargoKinds = (values: VehicleCargoSelectionValue): VehicleCargoKind[] =>
  CARGO_SELECTION.flatMap(([name, kind]) => values[name] ? [kind] : []);

export const toVehicleFormValues = (details: undefined | VehicleDetails): VehicleFormInputValue => ({
  details: {
    availability: Array.from({ length: VEHICLE_AVAILABILITY_CAPACITY }, (_row, index) =>
      toAvailabilityRow(details?.availability[index], index)),
    bodyType: details === undefined ? '' : String(details.bodyType),
    heightMillimeters: details === undefined ? '' : String(details.heightMillimeters),
    lengthMillimeters: details === undefined ? '' : String(details.lengthMillimeters),
    palletPlaces: String(details?.palletPlaces ?? 0),
    payloadGrams: details === undefined ? '' : String(details.payloadGrams),
    registrationNumber: details?.registrationNumber ?? '',
    temperature: {
      maxCelsius: details?.temperature === undefined ? '' : String(details.temperature.maxCelsius),
      minCelsius: details?.temperature === undefined ? '' : String(details.temperature.minCelsius),
    },
    volumeCubicCentimeters: details === undefined ? '' : String(details.volumeCubicCentimeters),
    widthMillimeters: details === undefined ? '' : String(details.widthMillimeters),
  },
  hasGeneralCargo: details?.cargoKinds.includes(VehicleCargoKind.GENERAL) ?? false,
  hasOversizeCargo: details?.cargoKinds.includes(VehicleCargoKind.OVERSIZE) ?? false,
  hasTemperatureControlledCargo: details?.cargoKinds.includes(VehicleCargoKind.TEMPERATURE_CONTROLLED) ?? false,
  windowOrder: details?.availability.map((_row, index) => index) ?? [],
});

export const collectVehicleFormIssues = (
  values: VehicleFormOutputValue,
  previous: undefined | VehicleDetails,
): readonly FormFieldIssueValue[] => {
  const { details, windowOrder } = values;
  const cargoKinds = getSelectedCargoKinds(values);
  const { maxCelsius, minCelsius } = details.temperature;
  const availability = readAvailabilityWindows(details.availability, windowOrder, previous?.availability ?? []);
  const issues: FormFieldIssueValue[] = [...availability.issues];
  const cargoIssues = validateFormValues(SaveVehicleRequestFormRules, { 'details.cargoKinds': cargoKinds }, ['details.cargoKinds']);

  for (const { ruleId } of cargoIssues) {
    issues.push({ field: 'hasGeneralCargo', ruleId });
  }
  if (details.palletPlaces === undefined) {
    issues.push({ field: 'details.palletPlaces', ruleId: 'required' });
  }
  for (const field of INT32_FIELDS) {
    const value = details[field];

    if (value !== undefined && value > INT32_MAX) {
      issues.push({ field: `details.${field}`, ruleId: 'fleet.integer_overflow' });
    }
  }
  for (const field of INT64_FIELDS) {
    if (details[field] > INT64_MAX) {
      issues.push({ field: `details.${field}`, ruleId: 'fleet.integer_overflow' });
    }
  }

  const isTemperatureExpected = values.hasTemperatureControlledCargo || minCelsius !== undefined || maxCelsius !== undefined;

  if (isTemperatureExpected && minCelsius === undefined) {
    issues.push({ field: 'details.temperature.minCelsius', ruleId: 'fleet.temperature_required' });
  }
  if (isTemperatureExpected && maxCelsius === undefined) {
    issues.push({ field: 'details.temperature.maxCelsius', ruleId: 'fleet.temperature_required' });
  }

  return issues;
};

export const buildVehicleDetails = (
  values: VehicleFormOutputValue,
  previous: undefined | VehicleDetails,
): MessageInitShape<typeof VehicleDetailsSchema> => {
  const { availability, temperature, ...details } = values.details;
  const windows = readAvailabilityWindows(availability, values.windowOrder, previous?.availability ?? []);

  if (windows.availability === undefined) {
    throw new Error('Vehicle availability is invalid');
  }

  return {
    ...details,
    availability: windows.availability,
    cargoKinds: getSelectedCargoKinds(values),
    temperature: temperature.maxCelsius === undefined || temperature.minCelsius === undefined
      ? undefined
      : { maxCelsius: temperature.maxCelsius, minCelsius: temperature.minCelsius },
  };
};
