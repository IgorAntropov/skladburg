import type { ListNotificationsResponse } from '@skladburg/contracts/notification/v1/notification';
import type { UndefinedInitialDataOptions } from '@tanstack/react-query';

import { NotificationService } from '@skladburg/contracts/notification/v1/notification';
import {
  queryOptions,
  skipToken,
} from '@tanstack/react-query';

import type { ApiClient } from '@/shared/api';

import { getOrganizationScope } from '@/shared/api';

import { notificationKeys } from './notificationKeys';
import { createNotificationQueryMeta } from './notificationScope';

export const NOTIFICATIONS_PAGE_SIZE = 30;

export interface CreateNotificationsQueryOptionsValue {
  client: ApiClient;
  organizationId: string | undefined;
  userId: string | undefined;
}

type NotificationsQueryKeyValue = ReturnType<typeof notificationKeys.list>;

export const createNotificationsQueryOptions = ({
  client,
  organizationId,
  userId,
}: CreateNotificationsQueryOptionsValue): UndefinedInitialDataOptions<
  ListNotificationsResponse,
  Error,
  ListNotificationsResponse,
  NotificationsQueryKeyValue
> => {
  const isContextComplete = organizationId !== undefined && userId !== undefined;

  return queryOptions({
    meta: createNotificationQueryMeta(userId),
    queryFn: isContextComplete
      ? (): Promise<ListNotificationsResponse> => client.service(NotificationService).listNotifications({
          page: { pageSize: NOTIFICATIONS_PAGE_SIZE, pageToken: '' },
        })
      : skipToken,
    queryKey: notificationKeys.list(getOrganizationScope(organizationId)),
  });
};
