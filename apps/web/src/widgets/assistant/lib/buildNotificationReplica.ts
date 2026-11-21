import type { Notification } from '@skladburg/contracts/notification/v1/notification';

import { NotificationImportance } from '@skladburg/contracts/notification/v1/notification';

import { resolveNotificationLinks } from '@/entities/notification';

import type {
  ReplicaImportanceValue,
  ReplicaValue,
} from '../model/replicaTypes';

const IMPORTANCE_BY_NOTIFICATION_IMPORTANCE = {
  [NotificationImportance.CRITICAL]: 'critical',
  [NotificationImportance.IMPORTANT]: 'important',
  [NotificationImportance.NORMAL]: 'normal',
  [NotificationImportance.UNSPECIFIED]: 'normal',
} as const satisfies Record<NotificationImportance, ReplicaImportanceValue>;

export const buildNotificationReplica = (notification: Notification): ReplicaValue => ({
  body: { kind: 'notification', notification },
  centerAction: notification.params.case === 'supportReply' ? 'openChat' : undefined,
  id: `notification:${notification.id}`,
  importance: IMPORTANCE_BY_NOTIFICATION_IMPORTANCE[notification.importance],
  links: resolveNotificationLinks(notification.links),
});

export const resolveCurrentReplica = (
  replica: ReplicaValue | undefined,
  notifications: readonly Notification[] | undefined,
): ReplicaValue | undefined => {
  if (replica?.body.kind !== 'notification' || replica.body.notification.params.case !== 'warehouseSensorAlert') {
    return replica;
  }

  const { id } = replica.body.notification;
  const current = notifications?.find(notification => notification.id === id);
  return current?.params.case === 'warehouseSensorAlert' ? buildNotificationReplica(current) : undefined;
};
