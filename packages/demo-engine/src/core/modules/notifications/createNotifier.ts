import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { NotificationSchema } from '@skladburg/contracts/notification/v1/notification';
import {
  NotificationsChange,
  NotificationsChangedSchema,
} from '@skladburg/contracts/notification/v1/notification_events';
import { userChannel } from '@skladburg/contracts/runtime';

import type { IRandom } from '../../ports/index';
import type { IEventOutbox } from '../moduleRuntime';
import type { INotifier } from './notifierTypes';

export interface CreateNotifierDependenciesValue {
  outbox: IEventOutbox;
  random: IRandom;
}

export const createNotifier = (dependencies: CreateNotifierDependenciesValue): INotifier => {
  const { outbox, random } = dependencies;

  return {
    post: (transaction, input) => {
      const ids: string[] = [];

      for (const userId of new Set(input.recipients)) {
        const notification = create(NotificationSchema, {
          createdAt: timestampFromMs(transaction.worldTimeMs),
          id: random.uuid(),
          importance: input.importance,
          kind: input.kind,
          links: [...input.links],
          organizationId: input.organizationId,
          params: input.params,
        });

        transaction.put('notifications', { notification, userId });
        outbox.add(transaction, userChannel(userId), {
          case: 'notificationsChanged',
          value: create(NotificationsChangedSchema, {
            change: NotificationsChange.POSTED,
            notificationIds: [notification.id],
          }),
        });
        ids.push(notification.id);
      }

      return ids;
    },
  };
};
