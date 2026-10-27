import type { ListNotificationsResponse } from '@skladburg/contracts/notification/v1/notification';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ListNotificationsResponseSchema,
  NotificationSchema,
} from '@skladburg/contracts/notification/v1/notification';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  applyAllNotificationsRead,
  applyNotificationsRead,
} from './applyNotificationsRead';

const FIRST_ID = 'f0000011-0000-4000-8000-000000000000';
const SECOND_ID = 'f0000012-0000-4000-8000-000000000000';
const READ_ID = 'f0000013-0000-4000-8000-000000000000';
const OLDER_READ_AT = timestampFromMs(1_000);
const READ_AT = timestampFromMs(5_000);

const createResponse = (): ListNotificationsResponse => create(ListNotificationsResponseSchema, {
  notifications: [
    create(NotificationSchema, { id: FIRST_ID }),
    create(NotificationSchema, { id: SECOND_ID }),
    create(NotificationSchema, { id: READ_ID, readAt: OLDER_READ_AT }),
  ],
  unreadCount: 5,
});

describe('applyNotificationsRead', () => {
  it('marks the listed unread notifications and lowers the counter by their number', () => {
    const result = applyNotificationsRead(createResponse(), [FIRST_ID], READ_AT);

    expect(result.notifications.map(notification => notification.readAt)).toEqual([READ_AT, undefined, OLDER_READ_AT]);
    expect(result.unreadCount).toBe(4);
  });

  it('does not touch the time of an already read notification and does not lower the counter for it', () => {
    const result = applyNotificationsRead(createResponse(), [READ_ID], READ_AT);

    expect(result.notifications[2]?.readAt).toBe(OLDER_READ_AT);
    expect(result.unreadCount).toBe(5);
  });

  it('does not lower the counter for a notification that is not on the first page', () => {
    expect(applyNotificationsRead(createResponse(), ['f0000099-0000-4000-8000-000000000000'], READ_AT).unreadCount).toBe(5);
  });

  it('does not take the counter below zero', () => {
    const response = { ...createResponse(), unreadCount: 1 };

    expect(applyNotificationsRead(response, [FIRST_ID, SECOND_ID], READ_AT).unreadCount).toBe(0);
  });

  it('does not change the source response', () => {
    const response = createResponse();

    applyNotificationsRead(response, [FIRST_ID], READ_AT);

    expect(response.notifications[0]?.readAt).toBeUndefined();
    expect(response.unreadCount).toBe(5);
  });
});

describe('applyAllNotificationsRead', () => {
  it('marks every unread notification and zeroes the counter', () => {
    const result = applyAllNotificationsRead(createResponse(), READ_AT);

    expect(result.notifications.map(notification => notification.readAt)).toEqual([READ_AT, READ_AT, OLDER_READ_AT]);
    expect(result.unreadCount).toBe(0);
  });
});
