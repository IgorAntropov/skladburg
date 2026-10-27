import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ObjectKind,
  type ObjectLink,
  ObjectLinkSchema,
} from '@skladburg/contracts/common/v1/object_link';
import {
  type Notification,
  NotificationImportance,
  NotificationKind,
  NotificationSchema,
  WarehouseCreatedParamsSchema,
} from '@skladburg/contracts/notification/v1/notification';

import type { TestRuntimeValue } from '../../testing/testRuntime';

export const WAREHOUSE_ID = '80000001-0000-4000-8000-000000000000';

export const createWarehouseCreatedParams = (): Notification['params'] => ({
  case: 'warehouseCreated',
  value: create(WarehouseCreatedParamsSchema, { cityName: 'Москва', warehouseId: WAREHOUSE_ID, warehouseName: 'Склад Северный' }),
});

export const createWarehouseLink = (): ObjectLink =>
  create(ObjectLinkSchema, {
    cameraFocus: { id: WAREHOUSE_ID, kind: ObjectKind.SITE },
    target: { id: WAREHOUSE_ID, kind: ObjectKind.SITE },
  });

export const postWarehouseNotification = (
  harness: TestRuntimeValue,
  recipients: readonly string[],
  organizationId: string,
): Promise<string[]> => harness.runtime.command(transaction => harness.runtime.notifier.post(transaction, {
  importance: NotificationImportance.NORMAL,
  kind: NotificationKind.WAREHOUSE_CREATED,
  links: [createWarehouseLink()],
  organizationId,
  params: createWarehouseCreatedParams(),
  recipients,
}));

export interface StoredNotificationOptionsValue {
  createdAtMs: number;
  id: string;
  isRead?: boolean | undefined;
  organizationId: string;
  userId: string;
}

export const storeNotification = (harness: TestRuntimeValue, options: StoredNotificationOptionsValue): Promise<void> =>
  harness.runtime.command((transaction) => {
    transaction.put('notifications', {
      notification: create(NotificationSchema, {
        createdAt: timestampFromMs(options.createdAtMs),
        id: options.id,
        importance: NotificationImportance.NORMAL,
        kind: NotificationKind.WAREHOUSE_CREATED,
        organizationId: options.organizationId,
        params: createWarehouseCreatedParams(),
        readAt: options.isRead === true ? timestampFromMs(options.createdAtMs) : undefined,
      }),
      userId: options.userId,
    });
  });

export const listEventsOnChannel = (harness: TestRuntimeValue, channel: string): TestRuntimeValue['events'] =>
  harness.events.filter(event => event.channel === channel);

export const withoutNotifications = async <THarness extends TestRuntimeValue>(harness: THarness): Promise<THarness> => {
  const stored = harness.state.read.list('notifications');

  await harness.runtime.command((transaction) => {
    for (const { notification } of stored) {
      transaction.delete('notifications', notification.id);
    }
  });

  harness.commits.length = 0;

  return harness;
};
