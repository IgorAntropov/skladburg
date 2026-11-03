import type {
  InfiniteData,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';

import {
  skipToken,
  useInfiniteQuery,
} from '@tanstack/react-query';

import {
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import type { OwnListingsPageValue } from './listingTypes';

import { fetchOwnListings } from './fetchOwnListings';
import { listingKeys } from './listingKeys';
import { createOwnListingQueryMeta } from './listingQueryMeta';

const FIRST_PAGE_TOKEN = '';

const getNextPageToken = (lastPage: OwnListingsPageValue): string | undefined => (
  lastPage.nextPageToken === '' ? undefined : lastPage.nextPageToken
);

export const useOwnListingsQuery = (query = ''): UseInfiniteQueryResult<InfiniteData<OwnListingsPageValue, string>> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  const isRequested = organizationId !== undefined;

  return useInfiniteQuery({
    getNextPageParam: getNextPageToken,
    initialPageParam: FIRST_PAGE_TOKEN,
    meta: createOwnListingQueryMeta(organizationId),
    queryFn: isRequested
      ? ({ pageParam }): Promise<OwnListingsPageValue> => fetchOwnListings(client, query, pageParam)
      : skipToken,
    queryKey: listingKeys.own(getOrganizationScope(organizationId), query),
  });
};
