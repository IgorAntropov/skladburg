import type { CarrierLane } from '@skladburg/contracts/fleet/v1/fleet';
import type { FormFieldIssueValue } from '@skladburg/contracts/forms';

import { validateFormValues } from '@skladburg/contracts/forms';
import { SaveCarrierLaneRequestFormRules } from '@skladburg/contracts/forms/fleet/v1/fleet';

import {
  formatMinorAsDecimal,
  parseDecimalToMinor,
} from '@/shared/lib/money';

export const WEEKDAYS = [
  { field: 'monday', value: 1 },
  { field: 'tuesday', value: 2 },
  { field: 'wednesday', value: 3 },
  { field: 'thursday', value: 4 },
  { field: 'friday', value: 5 },
  { field: 'saturday', value: 6 },
  { field: 'sunday', value: 7 },
] as const;

export const DEPARTURE_WEEKDAYS_FIELD = 'weekdays.monday';
const TARIFF_AMOUNT_FIELD = 'tariff.amountMinor';

export interface LaneFormValue {
  fromCityId: string;
  isActive: boolean;
  tariff: string;
  toCityId: string;
  weekdays: WeekdaySelectionValue;
}

type WeekdaySelectionValue = Record<WeekdayValue, boolean>;
type WeekdayValue = typeof WEEKDAYS[number]['field'];

const MAX_INT64 = 9_223_372_036_854_775_807n;
const RUB_SCALE = 100n;
const RUB_FRACTION_DIGITS = 2;

export const LANE_FORM_RULES = {
  fields: {
    ...SaveCarrierLaneRequestFormRules.fields,
    [TARIFF_AMOUNT_FIELD]: {
      ...SaveCarrierLaneRequestFormRules.fields[TARIFF_AMOUNT_FIELD],
      hasPresence: true,
      isRequired: true,
      lte: MAX_INT64,
    },
  },
};

export const toLaneFormValues = (lane: CarrierLane | undefined): LaneFormValue => {
  const amountMinor = lane?.tariff?.amountMinor;
  const weekdays: WeekdaySelectionValue = {
    friday: false,
    monday: false,
    saturday: false,
    sunday: false,
    thursday: false,
    tuesday: false,
    wednesday: false,
  };

  for (const { field, value } of WEEKDAYS) {
    weekdays[field] = lane?.departureWeekdays.includes(value) ?? false;
  }

  return {
    fromCityId: lane?.fromCityId ?? '',
    isActive: lane?.isActive ?? true,
    tariff: amountMinor === undefined ? '' : formatMinorAsDecimal(amountMinor, RUB_FRACTION_DIGITS),
    toCityId: lane?.toCityId ?? '',
    weekdays,
  };
};

export const toDepartureWeekdays = (weekdays: WeekdaySelectionValue): number[] =>
  WEEKDAYS.filter(({ field }) => weekdays[field]).map(({ value }) => value);

export const parseLaneTariff = (tariff: string): bigint | undefined => parseDecimalToMinor(tariff, RUB_SCALE);

export const mapLaneViolationPath = (fieldPath: string): string => {
  if (/^tariff(?:\.|$)/u.test(fieldPath)) {
    return 'tariff';
  }
  if (/^(?:departure_weekdays|departureWeekdays)(?:\[|\.|$)/u.test(fieldPath)) {
    return DEPARTURE_WEEKDAYS_FIELD;
  }

  return fieldPath;
};

export const validateLaneValues = ({ tariff, weekdays }: LaneFormValue): FormFieldIssueValue[] => {
  const amountMinor = parseLaneTariff(tariff);
  const issues = validateFormValues(
    LANE_FORM_RULES,
    { departureWeekdays: toDepartureWeekdays(weekdays), [TARIFF_AMOUNT_FIELD]: amountMinor },
    [TARIFF_AMOUNT_FIELD, 'departureWeekdays'],
  ).map(issue => ({ ...issue, field: mapLaneViolationPath(issue.field) }));

  return amountMinor === undefined && tariff.trim() !== ''
    ? [{ field: 'tariff', ruleId: 'fleet.tariff_invalid' }, ...issues.filter(issue => issue.field !== 'tariff')]
    : issues;
};
