import type { Money } from '@skladburg/contracts/common/v1/money';

import { DealService } from '@skladburg/contracts/deal/v1/deal';

import type { CommandValue } from '@/shared/api';

import {
  useApiClient,
  useCommand,
} from '@/shared/api';

import type { DealCommandContextValue } from './dealCommandContext';

import {
  dealCommandVersion,
  requireDealResult,
} from './dealCommandContext';
import { useDealConflictRefresh } from './useDealConflictRefresh';

interface ApproveDealOptions extends DealCommandContextValue {
  amount: Money | undefined;
  kind: 'acceptCounterOffer' | 'submitDeal';
}

export const useApproveDeal = ({ amount, deal, kind, onRefresh, onUpdated }: ApproveDealOptions): CommandValue => {
  const client = useApiClient();
  const command = useCommand({
    execute: async idempotencyKey => requireDealResult(await client.service(DealService)[kind]({
      ...dealCommandVersion(deal, idempotencyKey),
      goodsTotal: amount,
    })),
    method: DealService.method[kind],
    onSuccess: onUpdated,
  });
  useDealConflictRefresh(command, onRefresh);

  return command;
};
