import type { SalesTerms } from '@skladburg/contracts/catalog/v1/catalog';
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

export const useSalesTermsQuery = (): UseQueryResult<SalesTerms> => {
  const client = useApiClient();
  const { organizationId } = useActingContext();

  const isRequested = organizationId !== undefined;

  return useQuery({
    meta: createOwnListingQueryMeta(organizationId),
    queryFn: isRequested
      ? async (): Promise<SalesTerms> => {
        const response = await client.service(CatalogService).getSalesTerms({});

        if (response.terms === undefined) {
          throw new Error('GetSalesTerms response has no terms');
        }

        return response.terms;
      }
      : skipToken,
    queryKey: listingKeys.salesTerms(getOrganizationScope(organizationId)),
  });
};
