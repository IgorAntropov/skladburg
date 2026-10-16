import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { createSessionQueryOptions } from './sessionQueryOptions';

export const useSessionQuery = (): UseQueryResult<GetSessionResponse> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  return useQuery(createSessionQueryOptions({ client, organizationId, userId }));
};
