import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { ConfirmDealRequestFormRules } from '@skladburg/contracts/forms/deal/v1/deal';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import type { DealCommandContextValue } from './dealCommandContext';

import {
  dealCommandVersion,
  requireDealResult,
} from './dealCommandContext';

interface ConfirmDealFormValue {
  shipFromWarehouseId: string;
}

export const useConfirmDealForm = ({ deal, onUpdated }: DealCommandContextValue): CommandFormValue<ConfirmDealFormValue> => {
  const client = useApiClient();

  return useCommandForm({
    defaultValues: { shipFromWarehouseId: deal.shipFromWarehouseId },
    execute: async (values, idempotencyKey) => requireDealResult(await client.service(DealService).confirmDeal({
      ...dealCommandVersion(deal, idempotencyKey),
      goodsTotal: deal.goodsTotal,
      shipFromWarehouseId: values.shipFromWarehouseId,
    })),
    method: DealService.method.confirmDeal,
    onSuccess: onUpdated,
    rules: ConfirmDealRequestFormRules,
  });
};
