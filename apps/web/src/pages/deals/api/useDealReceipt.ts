import type { GetDealReceiptResponse } from '@skladburg/contracts/deal/v1/deal';
import type { UseQueryResult } from '@tanstack/react-query';

import { DealService } from '@skladburg/contracts/deal/v1/deal';
import {
  skipToken,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { CommandValue } from '@/shared/api';

import {
  getOrganizationScope,
  useActingContext,
  useApiClient,
  useCommand,
} from '@/shared/api';

import type { DealReceiptActionValue } from '../lib/dealReceiptActions';
import type { DealCommandContextValue } from './commands/dealCommandContext';

import {
  dealCommandVersion,
  requireDealResult,
} from './commands/dealCommandContext';
import { useDealConflictRefresh } from './commands/useDealConflictRefresh';
import { createDealQueryMeta } from './dealQueryScope';

const receiptKey = (organizationId: string | undefined, userId: string | undefined, dealId: string): readonly string[] =>
  ['deal', 'receipt', getOrganizationScope(organizationId), userId ?? '', dealId];

export const getDealReceiptMethod = DealService.method.getDealReceipt;

export const useDealReceipt = (dealId: string, isEnabled: boolean): UseQueryResult<GetDealReceiptResponse> => {
  const { organizationId, userId } = useActingContext();
  const client = useApiClient();

  return useQuery({
    meta: createDealQueryMeta(isEnabled ? organizationId : undefined, dealId),
    queryFn: isEnabled && organizationId !== undefined && userId !== undefined
      ? ({ signal }) => client.service(DealService).getDealReceipt({ dealId }, { signal })
      : skipToken,
    queryKey: receiptKey(organizationId, userId, dealId),
  });
};

interface DealReceiptCommandValue extends DealCommandContextValue {
  action: DealReceiptActionValue;
}

export const useDealReceiptCommand = ({ action, deal, onRefresh, onUpdated }: DealReceiptCommandValue): CommandValue => {
  const { organizationId, userId } = useActingContext();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const key = receiptKey(organizationId, userId, deal.id);

  const command = useCommand({
    execute: async idempotencyKey =>
      requireDealResult(await client.service(DealService)[action](dealCommandVersion(deal, idempotencyKey))),
    method: DealService.method[action],
    onSuccess: (updated) => {
      onUpdated(updated);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  useDealConflictRefresh(command, onRefresh);
  return command;
};
