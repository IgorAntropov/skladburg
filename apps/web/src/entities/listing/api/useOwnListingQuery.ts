import type { OwnListing } from '@skladburg/contracts/catalog/v1/catalog';
import type { UseQueryResult } from '@tanstack/react-query';

import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { listingKeys } from './listingKeys';
import { createOwnListingQueryMeta } from './listingQueryMeta';

export const useOwnListingQuery = (listingId: string | undefined): UseQueryResult<OwnListing> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  const isRequested = organizationId !== undefined && listingId !== undefined;

  return useQuery({
    meta: createOwnListingQueryMeta(organizationId),
    queryFn: isRequested
      ? async (): Promise<OwnListing> => {
        const response = await client.service(CatalogService).getOwnListing({ listingId });

        if (response.listing === undefined) {
          throw new Error('GetOwnListing response has no listing');
        }

        return response.listing;
      }
      : skipToken,
    queryKey: listingKeys.ownItem(getOrganizationScope(organizationId), listingId ?? ''),
  });
};
