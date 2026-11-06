import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { DealService } from '@skladburg/contracts/deal/v1/deal';
import {
  CounterDealLineFormRules,
  CounterDealRequestFormRules,
} from '@skladburg/contracts/forms/deal/v1/deal';
import {
  useMemo,
  useState,
} from 'react';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { formatIsoCalendarDate } from '@/shared/lib/calendar-date';
import { useCommandForm } from '@/shared/lib/form';
import { RUB_CURRENCY_CODE } from '@/shared/lib/money';

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

interface CounterDealFormValue {
  desiredDate: string;
  lines: { lineId: string; price: { amountMinor: string; currencyCode: string }; quantity: string }[];
  reason: string;
  shipFromWarehouseId: string;
}

interface CounterDealOptions extends DealCommandContextValue {
  initial: Deal;
}

interface CounterDealOutputValue extends Omit<CounterDealFormValue, 'lines'> {
  lines: { lineId: string; price: { amountMinor: bigint; currencyCode: string }; quantity: bigint }[];
}

export const useCounterDealForm = ({ deal, initial, onUpdated }: CounterDealOptions): CommandFormValue<CounterDealFormValue> => {
  const client = useApiClient();
  const [defaultValues] = useState<CounterDealFormValue>(() => ({
    desiredDate: initial.desiredDate === undefined ? '' : formatIsoCalendarDate(initial.desiredDate),
    lines: initial.lines.map(line => ({
      lineId: line.id,
      price: { amountMinor: line.price?.amountMinor.toString() ?? '', currencyCode: line.price?.currencyCode ?? RUB_CURRENCY_CODE },
      quantity: String(line.quantity),
    })),
    reason: '',
    shipFromWarehouseId: initial.shipFromWarehouseId,
  }));
  const rules = useMemo(
    () => createDealLineRules(
      CounterDealRequestFormRules,
      CounterDealLineFormRules,
      defaultValues.lines.length,
      ['quantity', 'price.amountMinor'],
    ),
    [defaultValues.lines.length],
  );

  return useCommandForm<CounterDealFormValue, Deal, CounterDealOutputValue>({
    defaultValues,
    execute: async (values, idempotencyKey) => requireDealResult(await client.service(DealService).counterDeal({
      ...values,
      ...dealCommandVersion(deal, idempotencyKey),
      desiredDate: requireDealDate(values.desiredDate),
      reason: values.reason.trim(),
    })),
    mapViolationPath: mapDealDatePath,
    method: DealService.method.counterDeal,
    onSuccess: onUpdated,
    rules,
    validateValues: values => validateDealDate(rules, values.desiredDate),
  });
};
