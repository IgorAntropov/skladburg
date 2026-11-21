import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  type WarehouseSensorAlert,
  WarehouseSensorAlertSchema,
} from '@skladburg/contracts/common/v1/warehouse_sensor_alert';
import {
  DigestItemKind,
  NotificationImportance,
  NotificationKind,
} from '@skladburg/contracts/notification/v1/notification';
import { NotificationsChange } from '@skladburg/contracts/notification/v1/notification_events';
import {
  sensorsChannel,
  userChannel,
} from '@skladburg/contracts/runtime';
import {
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  type ModuleHarnessValue,
  readErrorDetail,
} from '../testing/moduleHarness';
import {
  listEventsOnChannel,
  withoutNotifications,
} from './testing/notificationFixtures';
import { publishWarehouseSensorAlert } from './warehouseSensorAlerts';

const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const organizationId = SeedOrganizationId.CUSTOMER_1;
const open = create(WarehouseSensorAlertSchema, {
  channelId: '77000001-0000-4000-8000-000000000003',
  id: '77000001-0000-4000-8000-000000000001',
  openedAt: timestampFromMs(240_000),
  openedDeciCelsius: 85,
  thresholdDeciCelsius: 80,
  warehouseId,
  zoneCode: 'Z01',
  zoneId: '77000001-0000-4000-8000-000000000002',
});
const closed = create(WarehouseSensorAlertSchema, { ...open, resolvedAt: timestampFromMs(420_000), resolvedDeciCelsius: 70 });

const addViewer = (harness: ModuleHarnessValue): Promise<string> =>
  addTestMember(harness, { organizationId, permissions: ['sensor_view'], warehouseIds: [warehouseId] });
const publish = (harness: ModuleHarnessValue, alert: WarehouseSensorAlert): Promise<void> =>
  harness.runtime.command((transaction) => { publishWarehouseSensorAlert(harness.runtime, transaction, alert); });

it('posts a critical notice to viewers scoped to the warehouse and broadcasts only a warehouse id on the sensor channel', async () => {
  const harness = await withoutNotifications(createModuleHarness());
  const viewer = await addViewer(harness);
  const outside = await addTestMember(harness, {
    organizationId, permissions: ['sensor_view'], warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1],
  });
  const warehouseOnly = await addTestMember(harness, { organizationId, permissions: ['warehouse_view'], warehouseIds: [warehouseId] });
  const foreign = await addTestMember(harness, {
    organizationId: SeedOrganizationId.CUSTOMER_2, permissions: ['sensor_view'], warehouseIds: [warehouseId],
  });
  await publish(harness, open);
  const notice = await harness.notification.listNotifications({}, callAs(viewer, organizationId));
  expect(notice.unreadCount).toBe(1);
  expect(notice.notifications).toHaveLength(1);
  expect(notice.notifications[0]).toMatchObject({
    createdAt: open.openedAt,
    importance: NotificationImportance.CRITICAL,
    kind: NotificationKind.WAREHOUSE_SENSOR_ALERT,
    params: { case: 'warehouseSensorAlert', value: open },
  });
  expect(listEventsOnChannel(harness, userChannel(viewer)).map(event => event.payload)).toMatchObject([{
    case: 'notificationsChanged', value: { change: NotificationsChange.POSTED, notificationIds: [notice.notifications[0]?.id] },
  }]);
  expect(listEventsOnChannel(harness, sensorsChannel(warehouseId)).map(event => event.payload)).toEqual([{
    case: 'warehouseSensorAlertsChanged', value: { $typeName: 'wms.v1.WarehouseSensorAlertsChanged', warehouseId },
  }]);
  for (const userId of [outside, warehouseOnly, foreign]) {
    expect(listEventsOnChannel(harness, userChannel(userId))).toEqual([]);
    expect(harness.state.read.listBy('notifications', 'userId', userId)).toEqual([]);
  }
});

it('resolves the same notice in both the read and unread lists without posting to members who gained access later', async () => {
  const harness = await withoutNotifications(createModuleHarness());
  const reader = await addViewer(harness);
  const unreadViewer = await addViewer(harness);
  await publish(harness, open);
  const options = callAs(reader, organizationId);
  const unreadOptions = callAs(unreadViewer, organizationId);
  const [notice] = (await harness.notification.listNotifications({}, options)).notifications;
  const [unread] = (await harness.notification.listNotifications({}, unreadOptions)).notifications;
  if (notice === undefined || unread === undefined) {
    throw new Error('Expected a sensor alert notification for each viewer');
  }
  await harness.notification.markNotificationsRead({ idempotencyKey: harness.random.uuid(), notificationIds: [notice.id] }, options);
  const readAt = harness.state.read.get('notifications', notice.id)?.notification.readAt;
  expect(readAt).toBeDefined();
  const lateViewer = await addViewer(harness);
  harness.events.length = 0;
  await publish(harness, closed);
  const params = { case: 'warehouseSensorAlert', value: closed };
  expect(await harness.notification.listNotifications({}, options)).toMatchObject({
    notifications: [{ createdAt: notice.createdAt, id: notice.id, params, readAt }], unreadCount: 0,
  });
  const unreadResult = await harness.notification.listNotifications({}, unreadOptions);
  expect(unreadResult).toMatchObject({
    notifications: [{ createdAt: unread.createdAt, id: unread.id, params }], unreadCount: 1,
  });
  expect(unreadResult.notifications[0]?.readAt).toBeUndefined();
  expect(listEventsOnChannel(harness, userChannel(reader))).toMatchObject([{
    payload: { case: 'notificationsChanged', value: { change: NotificationsChange.UPDATED, notificationIds: [notice.id] } },
  }]);
  expect(listEventsOnChannel(harness, userChannel(lateViewer))).toEqual([]);
  expect(harness.state.read.listBy('notifications', 'userId', lateViewer)).toEqual([]);
});

it('rechecks the sensor scope for old alerts, counts and commands and keeps resolution private after access is revoked', async () => {
  const harness = await withoutNotifications(createModuleHarness());
  const viewer = await addViewer(harness);
  const options = callAs(viewer, organizationId);
  await publish(harness, open);
  const [notice] = (await harness.notification.listNotifications({}, options)).notifications;
  const [membership] = harness.state.read.listBy('memberships', 'userId', viewer);
  if (notice === undefined || membership === undefined) {
    throw new Error('Expected an active membership with a sensor alert notification');
  }
  await harness.runtime.command((transaction) => {
    transaction.put('memberships', {
      ...membership,
      roleAssignments: membership.roleAssignments.map(role => ({ ...role, warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1] })),
    });
  });
  harness.events.length = 0;
  await publish(harness, closed);
  expect(await harness.notification.listNotifications({}, options)).toMatchObject({ notifications: [], unreadCount: 0 });
  const digest = await harness.notification.getDigest({}, options);
  expect(digest.items.some(item => item.kind === DigestItemKind.UNREAD_NOTIFICATIONS)).toBe(false);
  const denied = await captureError(harness.notification.markNotificationsRead({
    idempotencyKey: harness.random.uuid(), notificationIds: [notice.id],
  }, options));
  expect(readErrorDetail(denied).code).toBe(ErrorCode.NOT_FOUND);
  expect((await harness.notification.markAllNotificationsRead({ idempotencyKey: harness.random.uuid() }, options)).unreadCount).toBe(0);
  expect(listEventsOnChannel(harness, userChannel(viewer))).toEqual([]);
  await harness.runtime.command((transaction) => {
    transaction.put('memberships', membership);
  });
  const restored = await harness.notification.listNotifications({}, options);
  expect(restored).toMatchObject({
    notifications: [{ id: notice.id, params: { case: 'warehouseSensorAlert', value: closed } }], unreadCount: 1,
  });
  expect(restored.notifications[0]?.readAt).toBeUndefined();
});
