import type { ListNotificationsResponse } from '@skladburg/contracts/notification/v1/notification';
import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { createNotificationsQueryOptions } from './notificationsQueryOptions';

const selectUnreadCount = (response: ListNotificationsResponse): number => response.unreadCount;

export const useUnreadNotificationCount = (): UseQueryResult<number> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  return useQuery({
    ...createNotificationsQueryOptions({ client, organizationId, userId }),
    select: selectUnreadCount,
  });
};
