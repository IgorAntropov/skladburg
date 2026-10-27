import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { ListNotificationsResponse } from '@skladburg/contracts/notification/v1/notification';

export const applyNotificationsRead = (
  response: ListNotificationsResponse,
  notificationIds: readonly string[],
  readAt: Timestamp,
): ListNotificationsResponse => {
  const targetIds = new Set(notificationIds);
  let newlyReadCount = 0;

  const notifications = response.notifications.map((notification) => {
    if (!targetIds.has(notification.id) || notification.readAt !== undefined) {
      return notification;
    }

    newlyReadCount += 1;

    return { ...notification, readAt };
  });

  return {
    ...response,
    notifications,
    unreadCount: Math.max(0, response.unreadCount - newlyReadCount),
  };
};

export const applyAllNotificationsRead = (
  response: ListNotificationsResponse,
  readAt: Timestamp,
): ListNotificationsResponse => ({
  ...response,
  notifications: response.notifications.map(notification => (
    notification.readAt === undefined ? { ...notification, readAt } : notification
  )),
  unreadCount: 0,
});
