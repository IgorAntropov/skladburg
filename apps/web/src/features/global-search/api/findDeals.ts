import { parseSearchQuery } from '@skladburg/contracts/runtime';

import type { ApiClient } from '@/shared/api';

import type { DealSearchResultValue } from '../model/searchSourceTypes';

import { findMatchRanges } from '../lib/findMatchRanges';

export const findDeals = async (client: ApiClient, query: string): Promise<DealSearchResultValue> => {
  const { DealService } = await import('@skladburg/contracts/deal/v1/deal');
  const { deals, page } = await client.service(DealService).listDeals({ page: { pageSize: 5 }, query });
  const parsedQuery = parseSearchQuery(query);

  return {
    candidates: deals.map((deal) => {
      const number = String(deal.number);
      const productName = deal.lines[0]?.productSnapshot?.name;
      const title = productName === undefined ? number : `${number} · ${productName}`;

      return {
        isGtinMatched: false,
        option: {
          address: { kind: 'object', object: { id: deal.id, type: 'deal' } },
          detail: { kind: 'deal' },
          detailMatches: [],
          groupId: 'deals',
          objectId: deal.id,
          title,
          titleMatches: findMatchRanges(title, parsedQuery),
        },
        rankText: number,
      };
    }),
    hasNextPage: Boolean(page?.nextPageToken),
  };
};
