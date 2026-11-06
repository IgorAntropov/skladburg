import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { DealService } from '@skladburg/contracts/deal/v1/deal';
import {
  DraftDealLineFormRules,
  UpdateDealDraftRequestFormRules,
} from '@skladburg/contracts/forms/deal/v1/deal';
import {
  useMemo,
  useState,
} from 'react';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { formatIsoCalendarDate } from '@/shared/lib/calendar-date';
import { useCommandForm } from '@/shared/lib/form';

import type { DealCommandContextValue } from './dealCommandContext';

import {
  dealCommandVersion,
  requireDealResult,
} from './dealCommandContext';
import {
  createDealLineRules,
  mapDealDatePath,
  requireDealDate,
  validateDealDate,
} from './dealFormValidation';

interface DraftDealFormValue {
  desiredDate: string;
  lines: { listingId: string; quantity: string }[];
  shipFromCityId: string;
  shipToWarehouseId: string;
}

interface DraftDealOutputValue extends Omit<DraftDealFormValue, 'lines'> {
  lines: { listingId: string; quantity: bigint }[];
}

interface UpdateDealDraftOptions extends DealCommandContextValue {
  initial: Deal;
}

export const useUpdateDealDraftForm = ({ deal, initial, onUpdated }: UpdateDealDraftOptions): CommandFormValue<DraftDealFormValue> => {
  const client = useApiClient();
  const [defaultValues] = useState<DraftDealFormValue>(() => ({
    desiredDate: initial.desiredDate === undefined ? '' : formatIsoCalendarDate(initial.desiredDate),
    lines: initial.lines.map(line => ({ listingId: line.listingId, quantity: String(line.quantity) })),
    shipFromCityId: initial.shipFromCityId,
    shipToWarehouseId: initial.shipToWarehouseId,
  }));
  const rules = useMemo(
    () => createDealLineRules(UpdateDealDraftRequestFormRules, DraftDealLineFormRules, defaultValues.lines.length, ['quantity']),
    [defaultValues.lines.length],
  );

  return useCommandForm<DraftDealFormValue, Deal, DraftDealOutputValue>({
    defaultValues,
    execute: async (values, idempotencyKey) => requireDealResult(await client.service(DealService).updateDealDraft({
      ...values,
      ...dealCommandVersion(deal, idempotencyKey),
      desiredDate: requireDealDate(values.desiredDate),
    })),
    mapViolationPath: mapDealDatePath,
    method: DealService.method.updateDealDraft,
    onSuccess: onUpdated,
    rules,
    validateValues: values => validateDealDate(rules, values.desiredDate),
  });
};
