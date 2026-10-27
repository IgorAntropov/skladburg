import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  GetDigestResponseSchema,
  ListNotificationsResponseSchema,
  MarkAllNotificationsReadResponseSchema,
  MarkNotificationsReadResponseSchema,
  NotificationService,
} from '@skladburg/contracts/notification/v1/notification';
import {
  NotificationsChange,
  NotificationsChangedSchema,
} from '@skladburg/contracts/notification/v1/notification_events';
import { userChannel } from '@skladburg/contracts/runtime';

import type {
  IStateTransaction,
  NotificationRecordValue,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { paginate } from '../pagination';
import { buildDigest } from './buildDigest';
import {
  countUnreadNotifications,
  isUnread,
  listUserNotifications,
} from './notificationRecords';
import { resolveNotificationCommandOrganizationId } from './resolveNotificationCommandOrganizationId';

export const createNotificationService = (runtime: IModuleRuntime): ServiceImpl<typeof NotificationService> => {
  const { command, errors, guard, idempotency, outbox, read } = runtime;

  const markRecordsRead = (
    transaction: IStateTransaction,
    userId: string,
    records: readonly NotificationRecordValue[],
  ): void => {
    const unread = records.filter(isUnread);

    if (unread.length === 0) {
      return;
    }

    for (const record of unread) {
      record.notification.readAt = timestampFromMs(transaction.worldTimeMs);
      transaction.put('notifications', record);
    }

    outbox.add(transaction, userChannel(userId), {
      case: 'notificationsChanged',
      value: create(NotificationsChangedSchema, {
        change: NotificationsChange.READ,
        notificationIds: unread.map(record => record.notification.id),
      }),
    });
  };

  return {
    getDigest: (request, context) => {
      const caller = guard.guardMemberCall(read, NotificationService.method.getDigest, request, context.requestHeader);

      return create(GetDigestResponseSchema, {
        items: buildDigest(read, caller),
      });
    },
    listNotifications: (request, context) => {
      const caller = guard.guardMemberCall(read, NotificationService.method.listNotifications, request, context.requestHeader);
      const records = listUserNotifications(read, caller.user.id, caller.organizationId);
      const { items, page } = paginate(records, record => record.notification.id, request.page, errors);

      return create(ListNotificationsResponseSchema, {
        notifications: items.map(record => record.notification),
        page,
        unreadCount: records.filter(isUnread).length,
      });
    },
    markAllNotificationsRead: (request, context) => command((transaction) => {
      const caller = guard.guardCall(transaction, NotificationService.method.markAllNotificationsRead, request, context.requestHeader);
      const organizationId = resolveNotificationCommandOrganizationId(context.requestHeader, errors);

      return idempotency.run(transaction, {
        handler: () => {
          markRecordsRead(transaction, caller.user.id, listUserNotifications(transaction, caller.user.id, organizationId));

          return create(MarkAllNotificationsReadResponseSchema, {
            unreadCount: countUnreadNotifications(transaction, caller.user.id, organizationId),
          });
        },
        idempotencyKey: request.idempotencyKey,
        method: NotificationService.method.markAllNotificationsRead,
        request,
        scope: [caller.user.id, organizationId].join(':'),
      });
    }),
    markNotificationsRead: (request, context) => command((transaction) => {
      const caller = guard.guardCall(transaction, NotificationService.method.markNotificationsRead, request, context.requestHeader);
      const organizationId = resolveNotificationCommandOrganizationId(context.requestHeader, errors);

      return idempotency.run(transaction, {
        handler: () => {
          const records = request.notificationIds.map((notificationId) => {
            const record = transaction.get('notifications', notificationId);

            if (record?.userId !== caller.user.id || record.notification.organizationId !== organizationId) {
              throw errors.notFound(EntityKind.NOTIFICATION);
            }

            return record;
          });

          markRecordsRead(transaction, caller.user.id, records);

          return create(MarkNotificationsReadResponseSchema, {
            unreadCount: countUnreadNotifications(transaction, caller.user.id, organizationId),
          });
        },
        idempotencyKey: request.idempotencyKey,
        method: NotificationService.method.markNotificationsRead,
        request,
        scope: [caller.user.id, organizationId].join(':'),
      });
    }),
  };
};
