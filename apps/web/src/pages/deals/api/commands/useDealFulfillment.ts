import { DealService } from '@skladburg/contracts/deal/v1/deal';

import type { CommandValue } from '@/shared/api';

import {
  useApiClient,
  useCommand,
} from '@/shared/api';

import type { DealFulfillmentActionValue } from '../../lib/dealFulfillment';
import type { DealCommandContextValue } from './dealCommandContext';

import {
  dealCommandVersion,
  requireDealResult,
} from './dealCommandContext';
import { useDealConflictRefresh } from './useDealConflictRefresh';

export const dealFulfillmentMethods = {
  acceptDeal: DealService.method.acceptDeal,
  markDealShipped: DealService.method.markDealShipped,
};

interface DealFulfillmentOptionsValue extends DealCommandContextValue {
  action: DealFulfillmentActionValue;
}

export const useDealFulfillment = ({ action, deal, onRefresh, onUpdated }: DealFulfillmentOptionsValue): CommandValue => {
  const client = useApiClient();
  const command = useCommand({
    execute: async idempotencyKey =>
      requireDealResult(await client.service(DealService)[action](dealCommandVersion(deal, idempotencyKey))),
    method: dealFulfillmentMethods[action],
    onSuccess: onUpdated,
  });
  useDealConflictRefresh(command, onRefresh);
  return command;
};
