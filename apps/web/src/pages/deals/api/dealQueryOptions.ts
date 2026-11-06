import type {
  Deal,
  GetDealResponse,
} from '@skladburg/contracts/deal/v1/deal';
import type { UndefinedInitialDataOptions } from '@tanstack/react-query';

import { DealService } from '@skladburg/contracts/deal/v1/deal';
import {
  queryOptions,
  skipToken,
} from '@tanstack/react-query';

import type { ApiClient } from '@/shared/api';

import { collectPages } from '@/shared/api';

import {
  createDealQueryMeta,
  dealKeys,
} from './dealQueryScope';

interface DealQueryContextValue {
  client: ApiClient;
  organizationId: string | undefined;
  userId: string | undefined;
}

export const createDealQueryOptions = (
  context: DealQueryContextValue,
  dealId: string | undefined,
): UndefinedInitialDataOptions<GetDealResponse, Error, GetDealResponse, readonly string[]> => {
  const { client, organizationId, userId } = context;

  return queryOptions({
    meta: createDealQueryMeta(organizationId, dealId),
    queryFn: organizationId !== undefined && userId !== undefined && dealId !== undefined
      ? () => client.service(DealService).getDeal({ dealId })
      : skipToken,
    queryKey: dealKeys.detail(organizationId, userId, dealId),
  });
};

export const createDealsQueryOptions = (
  context: DealQueryContextValue,
  isEnabled: boolean,
): UndefinedInitialDataOptions<Deal[], Error, Deal[], readonly string[]> => {
  const { client, organizationId, userId } = context;

  return queryOptions({
    meta: createDealQueryMeta(isEnabled ? organizationId : undefined),
    queryFn: isEnabled && organizationId !== undefined && userId !== undefined
      ? (): Promise<Deal[]> => collectPages(async (page) => {
          const response = await client.service(DealService).listDeals({ page });

          return { items: response.deals, nextPageToken: response.page?.nextPageToken ?? '' };
        })
      : skipToken,
    queryKey: dealKeys.list(organizationId, userId),
  });
};
