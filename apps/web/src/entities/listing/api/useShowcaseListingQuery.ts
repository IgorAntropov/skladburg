import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { UseQueryResult } from '@tanstack/react-query';

import { ShowcaseService } from '@skladburg/contracts/catalog/v1/showcase';
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
import { createShowcaseQueryMeta } from './listingQueryMeta';

export const useShowcaseListingQuery = (
  listingId: string | undefined,
  toWarehouseId: string,
): UseQueryResult<ShowcaseListing> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  const isRequested = organizationId !== undefined && listingId !== undefined;

  return useQuery({
    meta: createShowcaseQueryMeta(),
    queryFn: isRequested
      ? async (): Promise<ShowcaseListing> => {
        const response = await client.service(ShowcaseService).getShowcaseListing({ listingId, toWarehouseId });

        if (response.listing === undefined) {
          throw new Error('GetShowcaseListing response has no listing');
        }

        return response.listing;
      }
      : skipToken,
    queryKey: listingKeys.showcaseItem(getOrganizationScope(organizationId), listingId ?? '', toWarehouseId),
  });
};
