import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EventSchema } from '@skladburg/contracts/event/v1/event';
import { NotificationSchema } from '@skladburg/contracts/notification/v1/notification';
import {
  NotificationsChange,
  NotificationsChangedSchema,
} from '@skladburg/contracts/notification/v1/notification_events';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  collectPostedIds,
  selectPostedNotifications,
} from './selectPostedNotifications';

const createChangeEvent = (change: NotificationsChange, notificationIds: string[]): ReturnType<typeof create<typeof EventSchema>> => {
  return create(EventSchema, {
    payload: {
      case: 'notificationsChanged',
      value: create(NotificationsChangedSchema, { change, notificationIds }),
    },
  });
};

const createNotification = (id: string, isRead = false): ReturnType<typeof create<typeof NotificationSchema>> => {
  return create(NotificationSchema, { id, readAt: isRead ? timestampFromMs(1) : undefined });
};

describe('collectPostedIds', () => {
  it('takes the ids of posted notifications only', () => {
    const ids = collectPostedIds([
      createChangeEvent(NotificationsChange.POSTED, ['a', 'b']),
      createChangeEvent(NotificationsChange.READ, ['c']),
      createChangeEvent(NotificationsChange.POSTED, ['d']),
      create(EventSchema, {}),
    ]);

    expect(ids).toEqual(['a', 'b', 'd']);
  });

  it('returns nothing for an empty batch', () => {
    expect(collectPostedIds([])).toEqual([]);
  });
});

describe('selectPostedNotifications', () => {
  it('hands over a posted notification once it is in the list', () => {
    const { ready, waiting } = selectPostedNotifications({
      awaiting: [{ id: 'a', postedAtMs: 100 }],
      dataUpdatedAtMs: 200,
      narratedIds: new Set(),
      notifications: [createNotification('a'), createNotification('old')],
    });

    expect(ready.map(notification => notification.id)).toEqual(['a']);
    expect(waiting).toEqual([]);
  });

  it('keeps waiting while the list is older than the event', () => {
    const { ready, waiting } = selectPostedNotifications({
      awaiting: [{ id: 'a', postedAtMs: 300 }],
      dataUpdatedAtMs: 200,
      narratedIds: new Set(),
      notifications: [createNotification('old')],
    });

    expect(ready).toEqual([]);
    expect(waiting).toEqual([{ id: 'a', postedAtMs: 300 }]);
  });

  it('drops an id the list loaded after the event still does not have', () => {
    const { ready, waiting } = selectPostedNotifications({
      awaiting: [{ id: 'other-organization', postedAtMs: 300 }],
      dataUpdatedAtMs: 400,
      narratedIds: new Set(),
      notifications: [createNotification('old')],
    });

    expect(ready).toEqual([]);
    expect(waiting).toEqual([]);
  });

  it('does not tell a notification twice', () => {
    const { ready, waiting } = selectPostedNotifications({
      awaiting: [{ id: 'a', postedAtMs: 100 }],
      dataUpdatedAtMs: 200,
      narratedIds: new Set(['a']),
      notifications: [createNotification('a')],
    });

    expect(ready).toEqual([]);
    expect(waiting).toEqual([]);
  });

  it('does not tell a notification that was read already', () => {
    const { ready, waiting } = selectPostedNotifications({
      awaiting: [{ id: 'a', postedAtMs: 100 }],
      dataUpdatedAtMs: 200,
      narratedIds: new Set(),
      notifications: [createNotification('a', true)],
    });

    expect(ready).toEqual([]);
    expect(waiting).toEqual([]);
  });

  it('never tells notifications that nobody announced', () => {
    const { ready } = selectPostedNotifications({
      awaiting: [],
      dataUpdatedAtMs: 200,
      narratedIds: new Set(),
      notifications: [createNotification('start-1'), createNotification('start-2')],
    });

    expect(ready).toEqual([]);
  });
});
