import type { Event } from '@skladburg/contracts/event/v1/event';
import type { Notification } from '@skladburg/contracts/notification/v1/notification';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { NotificationsChange } from '@skladburg/contracts/notification/v1/notification_events';
import { userChannel } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';

import {
  createSeedNotifications,
  SEED_WORLD_START_MS,
  SeedNotificationId,
  SeedOrganizationId,
  SeedPersonaId,
  SeedUserId,
} from '../../seed/index';
import {
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import {
  listEventsOnChannel,
  postWarehouseNotification,
  type StoredNotificationOptionsValue,
  storeNotification,
  withoutNotifications,
} from './testing/notificationFixtures';

const FIRST_ID = '5a000001-0000-4000-8000-000000000000';
const SECOND_ID = '5a000002-0000-4000-8000-000000000000';
const THIRD_ID = '5a000003-0000-4000-8000-000000000000';
const FOREIGN_USER_ID = '5a000004-0000-4000-8000-000000000000';
const OTHER_ORGANIZATION_ID = '5a000005-0000-4000-8000-000000000000';
const UNKNOWN_ID = '5a000006-0000-4000-8000-000000000000';
const KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const OTHER_KEY = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const EARLY_MS = 1_000;
const LATE_MS = 3_000;
const DIRECTOR = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
const CUSTOMER_2_DIRECTOR = callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2);

const store = (
  harness: ModuleHarnessValue,
  id: string,
  overrides: Partial<StoredNotificationOptionsValue> = {},
): Promise<void> => storeNotification(harness, {
  createdAtMs: LATE_MS,
  id,
  organizationId: SeedOrganizationId.CUSTOMER_1,
  userId: SeedUserId.ADMIN_1,
  ...overrides,
});

const seedThreeNotifications = async (harness: ModuleHarnessValue): Promise<void> => {
  await store(harness, FIRST_ID, { createdAtMs: EARLY_MS, isRead: true });
  await store(harness, THIRD_ID);
  await store(harness, SECOND_ID);
};

const markRead = (
  harness: ModuleHarnessValue,
  notificationIds: string[],
  idempotencyKey: string = KEY,
): ReturnType<ModuleHarnessValue['notification']['markNotificationsRead']> =>
  harness.notification.markNotificationsRead({ idempotencyKey, notificationIds }, DIRECTOR);

const listOwn = async (harness: ModuleHarnessValue): Promise<Notification[]> =>
  (await harness.notification.listNotifications({}, DIRECTOR)).notifications;

const readCreatedAtMs = (notification: Notification): number =>
  notification.createdAt === undefined ? Number.NaN : timestampMs(notification.createdAt);

const readEventIds = (event: Event | undefined): string[] | undefined =>
  event?.payload.case === 'notificationsChanged' ? [...event.payload.value.notificationIds].sort() : undefined;

const readNotFoundEntity = async (call: Promise<unknown>): Promise<EntityKind | undefined> => {
  const error = await captureError(call);
  const { params } = readErrorDetail(error);

  expect(error.code).toBe(Code.NotFound);

  return params.case === 'notFound' ? params.value.entity : undefined;
};

const listReadEvents = (harness: ModuleHarnessValue, userId: string): ModuleHarnessValue['events'] =>
  listEventsOnChannel(harness, userChannel(userId)).filter(event =>
    event.payload.case === 'notificationsChanged' && event.payload.value.change === NotificationsChange.READ);

describe('NotificationService.listNotifications', () => {
  it('lists the newest first and the equal times by id, and counts the unread ones', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);

    const response = await harness.notification.listNotifications({}, DIRECTOR);

    expect(response.notifications.map(notification => notification.id)).toEqual([SECOND_ID, THIRD_ID, FIRST_ID]);
    expect(response.unreadCount).toBe(2);
    expect(response.page?.nextPageToken).toBe('');
    expect(response.notifications[2]?.readAt === undefined).toBe(false);
  });

  it('pages through the notifications by the id of the last one', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);

    const first = await harness.notification.listNotifications({ page: { pageSize: 2 } }, DIRECTOR);
    const second = await harness.notification.listNotifications(
      { page: { pageSize: 2, pageToken: first.page?.nextPageToken } },
      DIRECTOR,
    );

    expect(first.notifications.map(notification => notification.id)).toEqual([SECOND_ID, THIRD_ID]);
    expect(first.page?.nextPageToken).toBe(THIRD_ID);
    expect(second.notifications.map(notification => notification.id)).toEqual([FIRST_ID]);
    expect(first.unreadCount).toBe(2);
    expect(second.unreadCount).toBe(2);
  });

  it('shows nothing of the notifications of another user or of another organization', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);
    await store(harness, UNKNOWN_ID, { organizationId: OTHER_ORGANIZATION_ID });
    await store(harness, OTHER_ORGANIZATION_ID, { organizationId: SeedOrganizationId.CUSTOMER_2, userId: FOREIGN_USER_ID });

    const own = await harness.notification.listNotifications({}, DIRECTOR);
    const foreign = await harness.notification.listNotifications({}, CUSTOMER_2_DIRECTOR);

    expect(own.notifications.map(notification => notification.id)).toEqual([SECOND_ID, THIRD_ID, FIRST_ID]);
    expect(foreign.notifications).toEqual([]);
    expect(foreign.unreadCount).toBe(0);
  });

  it('keeps the stamp of the world time of the post', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await postWarehouseNotification(harness, [SeedUserId.ADMIN_1], SeedOrganizationId.CUSTOMER_1);

    const response = await harness.notification.listNotifications({}, DIRECTOR);
    const [notification] = response.notifications;

    expect(notification?.createdAt === undefined ? undefined : timestampMs(notification.createdAt)).toBe(harness.clock.now());
  });

  it('asks for a membership when the organization is not named', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    const error = await captureError(harness.notification.listNotifications({}, callAs(SeedUserId.ADMIN_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('asks for a session when the user is not named', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    const error = await captureError(harness.notification.listNotifications({}, callAs(undefined, SeedOrganizationId.CUSTOMER_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});

describe('NotificationService.listNotifications on the seed data', () => {
  it('shows the fresh customer exactly the two starting notifications, the newer one unread first', async () => {
    const harness = createModuleHarness();

    const response = await harness.notification.listNotifications({}, DIRECTOR);

    expect(response.notifications.map(notification => notification.id)).toEqual([
      SeedNotificationId.FRESH_CUSTOMER_PARTNER_SUPPLIER_2,
      SeedNotificationId.FRESH_CUSTOMER_PARTNER_SUPPLIER_1,
    ]);
    expect(response.notifications.map(notification => notification.readAt === undefined)).toEqual([true, false]);
    expect(response.unreadCount).toBe(1);
  });

  it('shows every persona exactly its own starting notifications of its organization and counts the unread ones of the seed', async () => {
    const harness = createModuleHarness();
    const seeded = createSeedNotifications(SEED_WORLD_START_MS);

    for (const persona of harness.state.read.list('personas')) {
      const own = seeded
        .filter(record => record.userId === persona.userId && record.notification.organizationId === persona.organizationId)
        .map(record => record.notification);
      const expectedIds = own
        .toSorted((left, right) => readCreatedAtMs(right) - readCreatedAtMs(left) || left.id.localeCompare(right.id))
        .map(notification => notification.id);

      const response = await harness.notification.listNotifications({}, callAs(persona.userId, persona.organizationId));

      expect(response.notifications.map(notification => notification.id), persona.id).toEqual(expectedIds);
      expect(response.unreadCount, persona.id).toBe(own.filter(notification => notification.readAt === undefined).length);
      expect(expectedIds.length === 0, persona.id).toBe(persona.id === SeedPersonaId.FRESH_BUYER);
    }
  });

  it('lists the starting notifications together with a new one of the world time as the newest', async () => {
    const harness = createModuleHarness();
    await postWarehouseNotification(harness, [SeedUserId.ADMIN_1], SeedOrganizationId.CUSTOMER_1);

    const response = await harness.notification.listNotifications({}, DIRECTOR);

    expect(response.notifications).toHaveLength(3);
    expect(response.notifications[0]?.id).not.toBe(SeedNotificationId.FRESH_CUSTOMER_PARTNER_SUPPLIER_2);
    expect(response.notifications.slice(1).map(notification => notification.id)).toEqual([
      SeedNotificationId.FRESH_CUSTOMER_PARTNER_SUPPLIER_2,
      SeedNotificationId.FRESH_CUSTOMER_PARTNER_SUPPLIER_1,
    ]);
    expect(response.unreadCount).toBe(2);
  });
});

describe('NotificationService.markNotificationsRead', () => {
  it('stamps its own notifications as read, answers with the unread count and tells the user channel once', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);

    const response = await markRead(harness, [SECOND_ID]);
    const listed = await harness.notification.listNotifications({}, DIRECTOR);
    const [event, ...rest] = listReadEvents(harness, SeedUserId.ADMIN_1);

    expect(response.unreadCount).toBe(1);
    expect(listed.notifications.find(notification => notification.id === SECOND_ID)?.readAt).toBeDefined();
    expect(listed.notifications.find(notification => notification.id === THIRD_ID)?.readAt).toBeUndefined();
    expect(rest).toEqual([]);
    expect(readEventIds(event)).toEqual([SECOND_ID]);
    expect(harness.events.filter(candidate => candidate.channel !== userChannel(SeedUserId.ADMIN_1))).toEqual([]);
  });

  it('puts only the notifications that changed into the event and keeps the earlier read time', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);
    const before = (await listOwn(harness)).find(notification => notification.id === FIRST_ID);

    const response = await markRead(harness, [FIRST_ID, THIRD_ID]);
    const after = (await listOwn(harness)).find(notification => notification.id === FIRST_ID);
    const [event] = listReadEvents(harness, SeedUserId.ADMIN_1);

    expect(response.unreadCount).toBe(1);
    expect(after?.readAt).toEqual(before?.readAt);
    expect(readEventIds(event)).toEqual([THIRD_ID]);
  });

  it('answers a repeat with the same key by the first answer and tells nothing a second time', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);

    const first = await markRead(harness, [SECOND_ID]);
    const repeated = await markRead(harness, [SECOND_ID]);

    expect(repeated.unreadCount).toBe(first.unreadCount);
    expect(listReadEvents(harness, SeedUserId.ADMIN_1)).toHaveLength(1);
  });

  it('accepts what is already read without an error and without an event', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);

    const response = await markRead(harness, [FIRST_ID]);

    expect(response.unreadCount).toBe(2);
    expect(listReadEvents(harness, SeedUserId.ADMIN_1)).toEqual([]);
    expect(harness.commits.at(-1)?.puts.notifications).toBeUndefined();
  });

  it('answers a missing, a foreign and a from-another-organization id with the same not found and marks none of the others', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);
    await store(harness, OTHER_ORGANIZATION_ID, { organizationId: SeedOrganizationId.CUSTOMER_2, userId: SeedUserId.ADMIN_5 });
    await store(harness, FOREIGN_USER_ID, { organizationId: OTHER_ORGANIZATION_ID });

    const outcomes = await Promise.all([UNKNOWN_ID, OTHER_ORGANIZATION_ID, FOREIGN_USER_ID].map(foreignId =>
      readNotFoundEntity(markRead(harness, [SECOND_ID, foreignId]))));
    const listed = await harness.notification.listNotifications({}, DIRECTOR);

    expect(outcomes).toEqual([EntityKind.NOTIFICATION, EntityKind.NOTIFICATION, EntityKind.NOTIFICATION]);
    expect(listed.unreadCount).toBe(2);
    expect(listReadEvents(harness, SeedUserId.ADMIN_1)).toEqual([]);
  });

  it('does not let another user mark a notification of the user', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);

    const entity = await readNotFoundEntity(
      harness.notification.markNotificationsRead({ idempotencyKey: KEY, notificationIds: [SECOND_ID] }, CUSTOMER_2_DIRECTOR),
    );

    expect(entity).toBe(EntityKind.NOTIFICATION);
    expect((await harness.notification.listNotifications({}, DIRECTOR)).unreadCount).toBe(2);
  });

  it('does not let another user mark it under the organization of the owner or under their own, and changes nothing', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);
    harness.commits.length = 0;
    harness.events.length = 0;

    const outcomes = await Promise.all([SeedOrganizationId.CUSTOMER_1, SeedOrganizationId.CUSTOMER_2].map(organizationId =>
      readNotFoundEntity(harness.notification.markNotificationsRead(
        { idempotencyKey: KEY, notificationIds: [SECOND_ID] },
        callAs(SeedUserId.ADMIN_5, organizationId),
      ))));

    expect(outcomes).toEqual([EntityKind.NOTIFICATION, EntityKind.NOTIFICATION]);
    expect((await listOwn(harness)).find(notification => notification.id === SECOND_ID)?.readAt).toBeUndefined();
    expect(harness.commits).toEqual([]);
    expect(harness.events).toEqual([]);
  });

  it('does not mark a notification of another organization of the same user under the header of the first one', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);
    await store(harness, UNKNOWN_ID, { organizationId: SeedOrganizationId.CUSTOMER_2 });
    harness.events.length = 0;

    const entity = await readNotFoundEntity(markRead(harness, [UNKNOWN_ID]));
    const inSecond = harness.state.read.get('notifications', UNKNOWN_ID);

    expect(entity).toBe(EntityKind.NOTIFICATION);
    expect(inSecond?.notification.readAt).toBeUndefined();
    expect(harness.events).toEqual([]);
  });

  it('asks for a membership when the organization is not named', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);

    const error = await captureError(
      harness.notification.markNotificationsRead({ idempotencyKey: KEY, notificationIds: [SECOND_ID] }, callAs(SeedUserId.ADMIN_1)),
    );

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    expect(listReadEvents(harness, SeedUserId.ADMIN_1)).toEqual([]);
  });

  it('rejects the reuse of a key for another set of ids', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);
    await markRead(harness, [SECOND_ID]);

    const error = await captureError(markRead(harness, [THIRD_ID]));

    expect(readErrorDetail(error).code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
  });
});

describe('NotificationService.markAllNotificationsRead', () => {
  it('reads every unread notification of the user in the organization, answers zero and tells the user channel once', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);
    await store(harness, UNKNOWN_ID, { organizationId: SeedOrganizationId.CUSTOMER_2, userId: SeedUserId.ADMIN_5 });

    const response = await harness.notification.markAllNotificationsRead({ idempotencyKey: KEY }, DIRECTOR);
    const [event, ...rest] = listReadEvents(harness, SeedUserId.ADMIN_1);

    expect(response.unreadCount).toBe(0);
    expect((await harness.notification.listNotifications({}, DIRECTOR)).unreadCount).toBe(0);
    expect((await harness.notification.listNotifications({}, CUSTOMER_2_DIRECTOR)).unreadCount).toBe(1);
    expect(rest).toEqual([]);
    expect(readEventIds(event)).toEqual([SECOND_ID, THIRD_ID]);
  });

  it('leaves the unread notifications of another organization of the same user alone and reports only the first one', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);
    await store(harness, UNKNOWN_ID, { organizationId: SeedOrganizationId.CUSTOMER_2 });
    harness.events.length = 0;

    const response = await harness.notification.markAllNotificationsRead({ idempotencyKey: KEY }, DIRECTOR);
    const inSecond = harness.state.read.get('notifications', UNKNOWN_ID);
    const [event, ...rest] = listReadEvents(harness, SeedUserId.ADMIN_1);

    expect(response.unreadCount).toBe(0);
    expect(inSecond?.notification.readAt).toBeUndefined();
    expect(rest).toEqual([]);
    expect(readEventIds(event)).toEqual([SECOND_ID, THIRD_ID]);
  });

  it('does not touch the notifications of the user when another user reads all, under any organization', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);
    harness.events.length = 0;

    await harness.notification.markAllNotificationsRead({ idempotencyKey: KEY }, CUSTOMER_2_DIRECTOR);
    await harness.notification.markAllNotificationsRead(
      { idempotencyKey: OTHER_KEY },
      callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_1),
    );

    expect((await harness.notification.listNotifications({}, DIRECTOR)).unreadCount).toBe(2);
    expect(harness.events).toEqual([]);
  });

  it('asks for a membership when the organization is not named', async () => {
    const harness = await withoutNotifications(createModuleHarness());
    await seedThreeNotifications(harness);

    const error = await captureError(harness.notification.markAllNotificationsRead({ idempotencyKey: KEY }, callAs(SeedUserId.ADMIN_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    expect(listReadEvents(harness, SeedUserId.ADMIN_1)).toEqual([]);
  });

  it('tells nothing when there was nothing unread, and nothing a second time on a repeat', async () => {
    const harness = await withoutNotifications(createModuleHarness());

    await harness.notification.markAllNotificationsRead({ idempotencyKey: KEY }, DIRECTOR);
    await seedThreeNotifications(harness);
    await harness.notification.markAllNotificationsRead({ idempotencyKey: OTHER_KEY }, DIRECTOR);
    await harness.notification.markAllNotificationsRead({ idempotencyKey: OTHER_KEY }, DIRECTOR);
    await harness.notification.markAllNotificationsRead({ idempotencyKey: KEY }, DIRECTOR);

    expect(listReadEvents(harness, SeedUserId.ADMIN_1)).toHaveLength(1);
  });
});
