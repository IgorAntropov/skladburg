import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  NotificationImportance,
  NotificationKind,
} from '@skladburg/contracts/notification/v1/notification';
import { NotificationsChange } from '@skladburg/contracts/notification/v1/notification_events';
import { userChannel } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/index';
import { createTestRuntime } from '../testing/testRuntime';
import {
  createWarehouseCreatedParams,
  createWarehouseLink,
  listEventsOnChannel,
  postWarehouseNotification,
  WAREHOUSE_ID,
  withoutNotifications,
} from './testing/notificationFixtures';

describe('notifier.post', () => {
  it('writes one notification per recipient with a world time stamp and the given content', async () => {
    const harness = await withoutNotifications(createTestRuntime());
    const ids = await postWarehouseNotification(harness, [SeedUserId.ADMIN_1, SeedUserId.STOREKEEPER_1], SeedOrganizationId.CUSTOMER_1);
    const records = harness.state.read.list('notifications');

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(records.map(record => record.userId).sort()).toEqual([SeedUserId.ADMIN_1, SeedUserId.STOREKEEPER_1].sort());

    for (const { notification } of records) {
      expect(notification.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
      expect(notification.kind).toBe(NotificationKind.WAREHOUSE_CREATED);
      expect(notification.importance).toBe(NotificationImportance.NORMAL);
      expect(notification.readAt).toBeUndefined();
      expect(notification.createdAt === undefined ? undefined : timestampMs(notification.createdAt)).toBe(harness.clock.now());
      expect(notification.params).toEqual(createWarehouseCreatedParams());
      expect(notification.links).toEqual([createWarehouseLink()]);
      expect(notification.params.case === 'warehouseCreated' && notification.params.value.warehouseId).toBe(WAREHOUSE_ID);
    }
  });

  it('publishes one posted event with the notification id into the channel of each recipient and nowhere else', async () => {
    const harness = await withoutNotifications(createTestRuntime());
    const ids = await postWarehouseNotification(harness, [SeedUserId.ADMIN_1, SeedUserId.STOREKEEPER_1], SeedOrganizationId.CUSTOMER_1);

    expect(harness.events).toHaveLength(2);

    for (const record of harness.state.read.list('notifications')) {
      const [event, ...rest] = listEventsOnChannel(harness, userChannel(record.userId));

      expect(rest).toEqual([]);
      expect(event?.payload.case).toBe('notificationsChanged');
      expect(event?.payload.case === 'notificationsChanged' && event.payload.value.change).toBe(NotificationsChange.POSTED);
      expect(event?.payload.case === 'notificationsChanged' && event.payload.value.notificationIds).toEqual([record.notification.id]);
      expect(ids).toContain(record.notification.id);
    }

    expect(listEventsOnChannel(harness, userChannel(SeedUserId.ADMIN_5))).toEqual([]);
  });

  it('posts once to a recipient listed twice', async () => {
    const harness = await withoutNotifications(createTestRuntime());
    const ids = await postWarehouseNotification(harness, [SeedUserId.ADMIN_1, SeedUserId.ADMIN_1], SeedOrganizationId.CUSTOMER_1);

    expect(ids).toHaveLength(1);
    expect(harness.state.read.list('notifications')).toHaveLength(1);
    expect(harness.events).toHaveLength(1);
  });

  it('does nothing for an empty list of recipients', async () => {
    const harness = await withoutNotifications(createTestRuntime());
    const ids = await postWarehouseNotification(harness, [], SeedOrganizationId.CUSTOMER_1);

    expect(ids).toEqual([]);
    expect(harness.state.read.list('notifications')).toEqual([]);
    expect(harness.events).toEqual([]);
    expect(harness.commits).toEqual([]);
  });

  it('leaves neither a record nor an event when the transaction of the command rolls back', async () => {
    const harness = await withoutNotifications(createTestRuntime());
    const failed = harness.runtime.command((transaction) => {
      harness.runtime.notifier.post(transaction, {
        importance: NotificationImportance.NORMAL,
        kind: NotificationKind.WAREHOUSE_CREATED,
        links: [],
        organizationId: SeedOrganizationId.CUSTOMER_1,
        params: createWarehouseCreatedParams(),
        recipients: [SeedUserId.ADMIN_1],
      });

      throw harness.runtime.errors.create(ErrorCode.INTERNAL);
    });

    await expect(failed).rejects.toThrow();
    expect(harness.state.read.list('notifications')).toEqual([]);
    expect(harness.events).toEqual([]);
    expect(harness.commits).toEqual([]);
  });

  it('hands out the same ids for the same random state', async () => {
    const first = await postWarehouseNotification(createTestRuntime(), [SeedUserId.ADMIN_1], SeedOrganizationId.CUSTOMER_1);
    const second = await postWarehouseNotification(createTestRuntime(), [SeedUserId.ADMIN_1], SeedOrganizationId.CUSTOMER_1);

    expect(first).toEqual(second);
  });
});
