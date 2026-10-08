import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { sessionKeys } from './sessionKeys';
import {
  createSessionQueryMeta,
  getSessionScope,
} from './sessionScope';

export const useSessionQuery = (): UseQueryResult<GetSessionResponse> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  const isContextComplete = organizationId !== undefined && userId !== undefined;

  return useQuery({
    meta: createSessionQueryMeta(organizationId, userId),
    queryFn: isContextComplete
      ? async (): Promise<GetSessionResponse> => client.access.getSession({})
      : skipToken,
    queryKey: sessionKeys.current(getSessionScope(organizationId), getSessionScope(userId)),
  });
};
