import type {
  InfiniteData,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';

import {
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
} from '@tanstack/react-query';

import {
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import type {
  ShowcaseListParamsValue,
  ShowcasePageValue,
} from './listingTypes';

import { fetchShowcaseListings } from './fetchShowcaseListings';
import { listingKeys } from './listingKeys';
import { createShowcaseQueryMeta } from './listingQueryMeta';

const FIRST_PAGE_TOKEN = '';

const getNextPageToken = (lastPage: ShowcasePageValue): string | undefined => (
  lastPage.nextPageToken === '' ? undefined : lastPage.nextPageToken
);

export const useShowcaseListingsQuery = (
  params: ShowcaseListParamsValue,
): UseInfiniteQueryResult<InfiniteData<ShowcasePageValue, string>> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  const isRequested = organizationId !== undefined;

  return useInfiniteQuery({
    getNextPageParam: getNextPageToken,
    initialPageParam: FIRST_PAGE_TOKEN,
    meta: createShowcaseQueryMeta(),
    placeholderData: keepPreviousData,
    queryFn: isRequested
      ? ({ pageParam }): Promise<ShowcasePageValue> => fetchShowcaseListings(client, params, pageParam)
      : skipToken,
    queryKey: listingKeys.showcase(getOrganizationScope(organizationId), params),
  });
};
