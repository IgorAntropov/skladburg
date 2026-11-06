import { DealService } from '@skladburg/contracts/deal/v1/deal';
import {
  CancelDealRequestFormRules,
  RejectCounterOfferRequestFormRules,
  RejectDealRequestFormRules,
} from '@skladburg/contracts/forms/deal/v1/deal';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import type { DealCommandContextValue } from './dealCommandContext';

import {
  dealCommandVersion,
  requireDealResult,
} from './dealCommandContext';

const RULES = {
  cancelDeal: CancelDealRequestFormRules,
  rejectCounterOffer: RejectCounterOfferRequestFormRules,
  rejectDeal: RejectDealRequestFormRules,
};

export type DealReasonCommand = keyof typeof RULES;

interface DealReasonOptions extends DealCommandContextValue {
  kind: DealReasonCommand;
}

export const useDealReasonForm = ({ deal, kind, onUpdated }: DealReasonOptions): CommandFormValue<{ reason: string }> => {
  const client = useApiClient();

  return useCommandForm({
    defaultValues: { reason: '' },
    execute: async (values, idempotencyKey) => requireDealResult(await client.service(DealService)[kind]({
      ...dealCommandVersion(deal, idempotencyKey),
      reason: values.reason.trim(),
    })),
    method: DealService.method[kind],
    onSuccess: onUpdated,
    rules: RULES[kind],
    validateValues: values => values.reason.trim() === '' ? [{ field: 'reason', ruleId: 'required' }] : [],
  });
};
