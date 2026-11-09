import type { CarrierLane } from '@skladburg/contracts/fleet/v1/fleet';

import { FleetService } from '@skladburg/contracts/fleet/v1/fleet';
import { useState } from 'react';

import type { CommandFormValue } from '@/shared/lib/form';

import {
  createUuid,
  useApiClient,
} from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';
import { RUB_CURRENCY_CODE } from '@/shared/lib/money';

import type { RecordsTranslate } from '../../records/i18n/recordsSection';
import type { LaneFormValue } from '../../records/laneFormValues';

import {
  LANE_FORM_RULES,
  mapLaneViolationPath,
  parseLaneTariff,
  toDepartureWeekdays,
  toLaneFormValues,
  validateLaneValues,
} from '../../records/laneFormValues';

const VIOLATION_TEXT = new Map<string, Parameters<RecordsTranslate>[0]>([
  ['fleet.carrier_lane_taken', 'garageRecords.validation.laneTaken'],
  ['fleet.city_exists', 'garageRecords.validation.cityExists'],
  ['fleet.tariff_invalid', 'garageRecords.validation.amountInvalid'],
  ['int64.gte_lte', 'garageRecords.validation.amountRange'],
  ['money.currency_unsupported', 'garageRecords.validation.currencyUnsupported'],
  ['repeated.min_items', 'garageRecords.validation.departureWeekdays'],
]);

export const useSaveCarrierLaneForm = (
  lane: CarrierLane | undefined,
  onSaved: (saved: CarrierLane) => void,
  t: RecordsTranslate | undefined,
): CommandFormValue<LaneFormValue> => {
  const client = useApiClient();
  const [baseline] = useState(() => ({ carrierLaneId: lane?.id ?? createUuid(), expectedVersion: lane?.version ?? 0n }));

  const execute = async (values: LaneFormValue, idempotencyKey: string): Promise<CarrierLane> => {
    const amountMinor = parseLaneTariff(values.tariff);

    if (amountMinor === undefined) {
      throw new Error('The lane tariff is invalid');
    }

    const response = await client.service(FleetService).saveCarrierLane({
      ...baseline,
      departureWeekdays: toDepartureWeekdays(values.weekdays),
      fromCityId: values.fromCityId,
      idempotencyKey,
      isActive: values.isActive,
      tariff: { amountMinor, currencyCode: RUB_CURRENCY_CODE },
      toCityId: values.toCityId,
    });

    if (response.carrierLane === undefined) {
      throw new Error('SaveCarrierLane response has no carrier lane');
    }

    return response.carrierLane;
  };

  const translateViolation = (ruleId: string): string | undefined => {
    const key = VIOLATION_TEXT.get(ruleId);

    return key === undefined ? undefined : t?.(key);
  };

  return useCommandForm<LaneFormValue, CarrierLane>({
    defaultValues: toLaneFormValues(lane),
    execute,
    mapViolationPath: mapLaneViolationPath,
    method: FleetService.method.saveCarrierLane,
    onSuccess: onSaved,
    rules: LANE_FORM_RULES,
    translateViolation,
    validateValues: validateLaneValues,
  });
};
