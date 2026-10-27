import type { Event } from '@skladburg/contracts/event/v1/event';
import type { Notification } from '@skladburg/contracts/notification/v1/notification';

import { NotificationsChange } from '@skladburg/contracts/notification/v1/notification_events';

export interface AwaitedNotificationValue {
  id: string;
  postedAtMs: number;
}

export interface SelectPostedNotificationsInputValue {
  awaiting: readonly AwaitedNotificationValue[];
  dataUpdatedAtMs: number;
  narratedIds: ReadonlySet<string>;
  notifications: readonly Notification[];
}

export interface SelectPostedNotificationsResultValue {
  ready: Notification[];
  waiting: AwaitedNotificationValue[];
}

export const collectPostedIds = (events: readonly Event[]): string[] => {
  return events.flatMap((event) => {
    const { payload } = event;

    return payload.case === 'notificationsChanged' && payload.value.change === NotificationsChange.POSTED
      ? payload.value.notificationIds
      : [];
  });
};

export const selectPostedNotifications = ({
  awaiting,
  dataUpdatedAtMs,
  narratedIds,
  notifications,
}: SelectPostedNotificationsInputValue): SelectPostedNotificationsResultValue => {
  const notificationById = new Map(notifications.map(notification => [notification.id, notification]));
  const ready: Notification[] = [];
  const waiting: AwaitedNotificationValue[] = [];

  for (const item of awaiting) {
    if (narratedIds.has(item.id)) {
      continue;
    }

    const notification = notificationById.get(item.id);

    if (notification === undefined) {
      if (dataUpdatedAtMs <= item.postedAtMs) {
        waiting.push(item);
      }

      continue;
    }

    if (notification.readAt === undefined) {
      ready.push(notification);
    }
  }

  return { ready, waiting };
};
