import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { UndefinedInitialDataOptions } from '@tanstack/react-query';

import { AccessService } from '@skladburg/contracts/access/v1/access';
import {
  queryOptions,
  skipToken,
} from '@tanstack/react-query';

import type { ApiClient } from '@/shared/api';

import { PREFETCH_HANDOFF_STALE_TIME_MS } from '@/shared/api';

import { sessionKeys } from './sessionKeys';
import {
  createSessionQueryMeta,
  getSessionScope,
} from './sessionScope';

export interface CreateSessionQueryOptionsValue {
  client: ApiClient;
  organizationId: string | undefined;
  userId: string | undefined;
}

type SessionQueryKeyValue = ReturnType<typeof sessionKeys.current>;

export const createSessionQueryOptions = ({
  client,
  organizationId,
  userId,
}: CreateSessionQueryOptionsValue): UndefinedInitialDataOptions<GetSessionResponse, Error, GetSessionResponse, SessionQueryKeyValue> => {
  const isContextComplete = organizationId !== undefined && userId !== undefined;

  return queryOptions({
    meta: createSessionQueryMeta(organizationId, userId),
    queryFn: isContextComplete
      ? async (): Promise<GetSessionResponse> => client.service(AccessService).getSession({})
      : skipToken,
    queryKey: sessionKeys.current(getSessionScope(organizationId), getSessionScope(userId)),
    staleTime: PREFETCH_HANDOFF_STALE_TIME_MS,
  });
};
