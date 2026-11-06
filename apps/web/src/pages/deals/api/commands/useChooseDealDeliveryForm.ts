import type { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';

import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { ChooseDeliveryRequestFormRules } from '@skladburg/contracts/forms/deal/v1/deal';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import type { DealCommandContextValue } from './dealCommandContext';

import {
  dealCommandVersion,
  requireDealResult,
} from './dealCommandContext';

export const useChooseDealDeliveryForm = ({ deal, onUpdated }: DealCommandContextValue): CommandFormValue<{ deliveryMethod: string }> => {
  const client = useApiClient();

  return useCommandForm<{ deliveryMethod: string }, typeof deal, { deliveryMethod: DeliveryMethod }>({
    defaultValues: { deliveryMethod: '' },
    execute: async (values, idempotencyKey) => requireDealResult(await client.service(DealService).chooseDelivery({
      ...dealCommandVersion(deal, idempotencyKey),
      deliveryMethod: values.deliveryMethod,
    })),
    method: DealService.method.chooseDelivery,
    onSuccess: onUpdated,
    rules: {
      fields: {
        ...ChooseDeliveryRequestFormRules.fields,
        deliveryMethod: { ...ChooseDeliveryRequestFormRules.fields.deliveryMethod, isRequired: true },
      },
    },
  });
};
