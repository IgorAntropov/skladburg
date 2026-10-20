import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { createSessionQueryOptions } from './sessionQueryOptions';

export interface SessionQueryOptionsValue<TData> {
  isEnabled?: boolean | undefined;
  select?: ((session: GetSessionResponse) => TData) | undefined;
}

export const useSessionQuery = <TData = GetSessionResponse>(
  options?: SessionQueryOptionsValue<TData>,
): UseQueryResult<TData> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  return useQuery({
    ...createSessionQueryOptions({ client, organizationId, userId }),
    enabled: options?.isEnabled,
    select: options?.select,
  });
};
