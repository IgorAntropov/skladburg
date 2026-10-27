import { timestampMs } from '@bufbuild/protobuf/wkt';

import type {
  IStateReader,
  NotificationRecordValue,
} from '../../state/index';

import { compareIds } from '../../state/index';

const compareNewestFirst = (current: NotificationRecordValue, next: NotificationRecordValue): number => {
  const currentMs = current.notification.createdAt === undefined ? 0 : timestampMs(current.notification.createdAt);
  const nextMs = next.notification.createdAt === undefined ? 0 : timestampMs(next.notification.createdAt);

  return nextMs - currentMs || compareIds(current.notification.id, next.notification.id);
};

export const isUnread = (record: NotificationRecordValue): boolean => record.notification.readAt === undefined;

export const listUserNotifications = (
  reader: IStateReader,
  userId: string,
  organizationId: string,
): NotificationRecordValue[] =>
  reader.listBy('notifications', 'userId', userId)
    .filter(record => record.notification.organizationId === organizationId)
    .sort(compareNewestFirst);

export const countUnreadNotifications = (reader: IStateReader, userId: string, organizationId: string): number =>
  listUserNotifications(reader, userId, organizationId).filter(isUnread).length;
