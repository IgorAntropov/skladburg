import type { ListNotificationsResponse } from '@skladburg/contracts/notification/v1/notification';
import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { createNotificationsQueryOptions } from './notificationsQueryOptions';

export const useNotificationsQuery = (): UseQueryResult<ListNotificationsResponse> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  return useQuery(createNotificationsQueryOptions({ client, organizationId, userId }));
};
