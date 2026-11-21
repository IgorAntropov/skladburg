import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ObjectKind,
  ObjectLinkSchema,
  ObjectRefSchema,
} from '@skladburg/contracts/common/v1/object_link';
import {
  NotificationImportance,
  NotificationKind,
  NotificationSchema,
  SupportReplyParamsSchema,
} from '@skladburg/contracts/notification/v1/notification';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildNotificationReplica,
  resolveCurrentReplica,
} from './buildNotificationReplica';

const SITE_ID = '00000000-0000-4000-8000-000000000002';

const createSiteLink = (): ReturnType<typeof create<typeof ObjectLinkSchema>> => {
  const ref = create(ObjectRefSchema, { id: SITE_ID, kind: ObjectKind.SITE });

  return create(ObjectLinkSchema, { cameraFocus: ref, target: ref });
};

describe('buildNotificationReplica', () => {
  it('refreshes a visible or queued alert by its notification ID and hides it when it leaves the visible list', () => {
    const opened = create(NotificationSchema, { id: 'sensor-1', params: { case: 'warehouseSensorAlert', value: { zoneCode: 'Z01' } } });
    const replica = buildNotificationReplica(opened);
    const recovered = create(NotificationSchema, {
      id: opened.id,
      params: { case: 'warehouseSensorAlert', value: { resolvedAt: timestampFromMs(420_000), zoneCode: 'Z01' } },
    });
    const other = create(NotificationSchema, { id: 'sensor-2', params: opened.params });

    expect(resolveCurrentReplica(replica, [other, recovered])).toEqual(buildNotificationReplica(recovered));
    expect(resolveCurrentReplica(replica, [other])).toBeUndefined();
    expect(resolveCurrentReplica(replica, undefined)).toBeUndefined();
    const ordinary = buildNotificationReplica(create(NotificationSchema, { id: 'ordinary' }));
    expect(resolveCurrentReplica(ordinary, [])).toBe(ordinary);
  });

  it('turns a notification with a camera link into a replica with a map link', () => {
    const replica = buildNotificationReplica(create(NotificationSchema, {
      id: 'n-1',
      importance: NotificationImportance.NORMAL,
      kind: NotificationKind.WAREHOUSE_CREATED,
      links: [createSiteLink()],
    }));

    expect(replica.id).toBe('notification:n-1');
    expect(replica.links).toHaveLength(1);
    expect(replica.links[0]?.kind).toBe('map');
    expect(replica.links[0]?.isFocusRequested).toBe(true);
    expect(replica.links[0]?.address).toEqual({ kind: 'object', object: { id: SITE_ID, type: 'site' } });
    expect(replica.centerAction).toBeUndefined();
  });

  it('offers to open the chat for a support reply', () => {
    const replica = buildNotificationReplica(create(NotificationSchema, {
      id: 'n-2',
      importance: NotificationImportance.IMPORTANT,
      kind: NotificationKind.SUPPORT_REPLY,
      params: { case: 'supportReply', value: create(SupportReplyParamsSchema, { ticketId: 'ticket-1', ticketNumber: 12 }) },
    }));

    expect(replica.centerAction).toBe('openChat');
  });

  it.each([
    [NotificationImportance.NORMAL, 'normal'],
    [NotificationImportance.IMPORTANT, 'important'],
    [NotificationImportance.CRITICAL, 'critical'],
    [NotificationImportance.UNSPECIFIED, 'normal'],
  ] as const)('maps importance %s to %s', (importance, expected) => {
    expect(buildNotificationReplica(create(NotificationSchema, { id: 'n', importance })).importance).toBe(expected);
  });
});
