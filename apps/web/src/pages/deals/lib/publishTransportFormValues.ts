import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { FormFieldIssueValue } from '@skladburg/contracts/forms';
import type { TransportCargo } from '@skladburg/contracts/logistics/v1/logistics_records';

import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import {
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';
import { validateFormValues } from '@skladburg/contracts/forms';
import { PublishTransportRequestRequestFormRules } from '@skladburg/contracts/forms/logistics/v1/logistics';

import { parseUtcDateTime } from '@/shared/lib/calendar-date';

export const TRANSPORT_BODY_TYPES = [
  ['curtainSide', VehicleBodyType.CURTAIN_SIDE],
  ['refrigerated', VehicleBodyType.REFRIGERATED],
  ['insulated', VehicleBodyType.INSULATED],
  ['flatbed', VehicleBodyType.FLATBED],
  ['longHaul', VehicleBodyType.LONG_HAUL],
  ['lowLoader', VehicleBodyType.LOW_LOADER],
] as const;

export interface PublishTransportInputValue extends PublishTransportWindowsValue {
  cargo: Record<'cargoKind' | 'palletPlaces' | keyof CargoMeasurementsValue, string> & {
    temperature: { maxCelsius: string; minCelsius: string };
  };
}

export interface PublishTransportOutputValue extends PublishTransportWindowsValue {
  cargo: CargoFormValue & CargoMeasurementsValue;
}

export type PublishWindowPathValue = 'deliveryWindow' | 'pickupWindow';

type BodyTypesInputValue = Record<typeof TRANSPORT_BODY_TYPES[number][0], boolean>;
interface CargoFormValue {
  cargoKind: VehicleCargoKind;
  palletPlaces: number | undefined;
  temperature: { maxCelsius: number | undefined; minCelsius: number | undefined };
}

type CargoMeasurementsValue = Pick<TransportCargo, 'heightMillimeters' | 'lengthMillimeters' | 'volumeCubicCentimeters'
  | 'weightGrams' | 'widthMillimeters'>;

interface PublishTransportWindowsValue {
  bodyTypes: BodyTypesInputValue;
  deliveryWindow: WindowInputValue;
  pickupWindow: WindowInputValue;
}

interface WindowInputValue {
  endDate: string;
  endTime: string;
  startDate: string;
  startTime: string;
}

interface WindowOutputValue {
  endsAt: Timestamp;
  startsAt: Timestamp;
}

const EMPTY_WINDOW = { endDate: '', endTime: '', startDate: '', startTime: '' };

export const PUBLISH_TRANSPORT_DEFAULT_VALUES: PublishTransportInputValue = {
  bodyTypes: { curtainSide: false, flatbed: false, insulated: false, longHaul: false, lowLoader: false, refrigerated: false },
  cargo: {
    cargoKind: '',
    heightMillimeters: '',
    lengthMillimeters: '',
    palletPlaces: '',
    temperature: { maxCelsius: '', minCelsius: '' },
    volumeCubicCentimeters: '',
    weightGrams: '',
    widthMillimeters: '',
  },
  deliveryWindow: { ...EMPTY_WINDOW },
  pickupWindow: { ...EMPTY_WINDOW },
};

export const getTransportBodyTypes = (bodyTypes: BodyTypesInputValue): VehicleBodyType[] =>
  TRANSPORT_BODY_TYPES.flatMap(([field, type]) => bodyTypes[field] ? [type] : []);

export const toTransportWindow = ({ endDate, endTime, startDate, startTime }: WindowInputValue): undefined | WindowOutputValue => {
  const start = parseUtcDateTime(startDate, startTime).value;
  const end = parseUtcDateTime(endDate, endTime).value;

  return start !== undefined && end !== undefined && start < end
    ? { endsAt: timestampFromDate(end), startsAt: timestampFromDate(start) }
    : undefined;
};

const collectWindowIssues = (path: PublishWindowPathValue, window: WindowInputValue): FormFieldIssueValue[] => {
  const start = parseUtcDateTime(window.startDate, window.startTime);
  const end = parseUtcDateTime(window.endDate, window.endTime);
  const issues: FormFieldIssueValue[] = [];

  if (start.field !== undefined) {
    issues.push({ field: `${path}.${start.field === 'date' ? 'startDate' : 'startTime'}`, ruleId: `transport.${start.field}` });
  }
  if (end.field !== undefined) {
    issues.push({ field: `${path}.${end.field === 'date' ? 'endDate' : 'endTime'}`, ruleId: `transport.${end.field}` });
  }
  if (start.value !== undefined && end.value !== undefined && start.value >= end.value) {
    issues.push({ field: `${path}.endTime`, ruleId: 'logistics.window_invalid' });
  }

  return issues;
};

const collectTemperatureIssues = ({ cargoKind, temperature }: CargoFormValue): FormFieldIssueValue[] => {
  const { maxCelsius, minCelsius } = temperature;
  if (cargoKind !== VehicleCargoKind.TEMPERATURE_CONTROLLED && maxCelsius === undefined && minCelsius === undefined) {
    return [];
  }

  const issues: FormFieldIssueValue[] = [];
  if (minCelsius === undefined) {
    issues.push({ field: 'cargo.temperature.minCelsius', ruleId: 'required' });
  }
  if (maxCelsius === undefined) {
    issues.push({ field: 'cargo.temperature.maxCelsius', ruleId: 'required' });
  }
  if (minCelsius !== undefined && maxCelsius !== undefined && maxCelsius < minCelsius) {
    issues.push({ field: 'cargo.temperature.maxCelsius', ruleId: 'logistics.temperature_range_order' });
  }

  return issues;
};

export const collectPublishTransportIssues = (values: PublishTransportOutputValue): FormFieldIssueValue[] => {
  const bodyTypes = getTransportBodyTypes(values.bodyTypes);
  const bodyTypeIssues = validateFormValues(PublishTransportRequestRequestFormRules, { 'cargo.bodyTypes': bodyTypes }, ['cargo.bodyTypes']);

  return [
    ...bodyTypeIssues.map(issue => ({ ...issue, field: 'bodyTypes.curtainSide' })),
    ...collectTemperatureIssues(values.cargo),
    ...collectWindowIssues('pickupWindow', values.pickupWindow),
    ...collectWindowIssues('deliveryWindow', values.deliveryWindow),
  ];
};

const FIELD_PATHS: Readonly<Partial<Record<string, string>>> = {
  'cargo.temperature': 'cargo.temperature.minCelsius',
  'delivery_window': 'deliveryWindow.endTime',
  'delivery_window.ends_at': 'deliveryWindow.endTime',
  'delivery_window.starts_at': 'deliveryWindow.startTime',
  'pickup_window': 'pickupWindow.endTime',
  'pickup_window.ends_at': 'pickupWindow.endTime',
  'pickup_window.starts_at': 'pickupWindow.startTime',
};

export const mapPublishTransportViolationPath = (path: string): string => {
  if (path === 'cargo.body_types' || path.startsWith('cargo.body_types[')) {
    return 'bodyTypes.curtainSide';
  }

  return Object.hasOwn(FIELD_PATHS, path) ? (FIELD_PATHS[path] ?? path) : path;
};
