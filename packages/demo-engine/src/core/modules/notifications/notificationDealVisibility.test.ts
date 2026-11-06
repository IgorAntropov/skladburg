import { create } from '@bufbuild/protobuf';
import { MembershipSchema } from '@skladburg/contracts/access/v1/access';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { DigestItemKind } from '@skladburg/contracts/notification/v1/notification';
import { NotificationsChange } from '@skladburg/contracts/notification/v1/notification_events';
import { SUPPORT_SESSION_HEADER } from '@skladburg/contracts/runtime';
import { SupportAccessStatus } from '@skladburg/contracts/support/v1/support_access';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import {
  nextUuid,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import {
  createDealFixture,
  createSubmittedDeal,
} from '../deals/testing/dealFixtures';
import { putSession } from '../platform/testing/supportAccessFixtures';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import {
  postWarehouseNotification,
  withoutNotifications,
} from './testing/notificationFixtures';

interface DealNotificationsFixtureValue {
  dealId: string;
  dealNotificationId: string;
  harness: ModuleHarnessValue;
  warehouseNotificationId: string;
}

const createFixture = async (): Promise<DealNotificationsFixtureValue> => {
  const { harness, request } = await createDealFixture();
  await withoutNotifications(harness);
  const deal = await createSubmittedDeal(harness, request);
  const { notifications } = await harness.notification.listNotifications({}, SUPPLIER_1_CALL);
  const [warehouseNotificationId] = await postWarehouseNotification(harness, [SeedUserId.ADMIN_2], SeedOrganizationId.SUPPLIER_1);
  const dealNotificationId = notifications[0]?.id;

  if (dealNotificationId === undefined || warehouseNotificationId === undefined) {
    throw new Error('Expected both notification fixtures');
  }

  harness.events.length = 0;

  return { dealId: deal.id, dealNotificationId, harness, warehouseNotificationId };
};

const revokeDealView = (harness: ModuleHarnessValue): Promise<void> => harness.runtime.command((transaction) => {
  for (const membership of transaction.listBy('memberships', 'userId', SeedUserId.ADMIN_2)) {
    if (membership.organizationId === SeedOrganizationId.SUPPLIER_1) {
      transaction.put('memberships', create(MembershipSchema, { ...membership, roleAssignments: [] }));
    }
  }
});

describe('current visibility of deal notifications', () => {
  it('hides an existing deal notification and excludes it from unread and digest after deal_view is revoked', async () => {
    const { harness, warehouseNotificationId } = await createFixture();
    expect((await harness.notification.listNotifications({}, SUPPLIER_1_CALL)).unreadCount).toBe(2);

    await revokeDealView(harness);
    const listed = await harness.notification.listNotifications({}, SUPPLIER_1_CALL);
    const digest = await harness.notification.getDigest({}, SUPPLIER_1_CALL);

    expect(listed.notifications.map(notification => notification.id)).toEqual([warehouseNotificationId]);
    expect(listed.unreadCount).toBe(1);
    expect(digest.items.find(item => item.kind === DigestItemKind.UNREAD_NOTIFICATIONS)?.count).toBe(1);
  });

  it('refuses a hidden notification by id and marks only currently visible records through mark-all', async () => {
    const { dealNotificationId, harness, warehouseNotificationId } = await createFixture();
    await revokeDealView(harness);

    const denied = await captureError(harness.notification.markNotificationsRead({
      idempotencyKey: nextUuid(),
      notificationIds: [warehouseNotificationId, dealNotificationId],
    }, SUPPLIER_1_CALL));

    expect(readErrorDetail(denied).code).toBe(ErrorCode.NOT_FOUND);
    expect(harness.state.read.get('notifications', warehouseNotificationId)?.notification.readAt).toBeUndefined();

    const marked = await harness.notification.markAllNotificationsRead({ idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);
    const readIds = harness.events.flatMap(event => event.payload.case === 'notificationsChanged'
      && event.payload.value.change === NotificationsChange.READ
      ? event.payload.value.notificationIds
      : []);

    expect(marked.unreadCount).toBe(0);
    expect(readIds).toEqual([warehouseNotificationId]);
    expect(harness.state.read.get('notifications', dealNotificationId)?.notification.readAt).toBeUndefined();
  });

  it('checks current visibility before replaying a previously successful mark by id', async () => {
    const { dealNotificationId, harness } = await createFixture();
    const request = { idempotencyKey: nextUuid(), notificationIds: [dealNotificationId] };
    await harness.notification.markNotificationsRead(request, SUPPLIER_1_CALL);
    await revokeDealView(harness);
    harness.events.length = 0;

    const denied = await captureError(harness.notification.markNotificationsRead(request, SUPPLIER_1_CALL));

    expect(readErrorDetail(denied).code).toBe(ErrorCode.NOT_FOUND);
    expect(harness.events).toEqual([]);
  });

  it('recounts the visible unread total on replay without repeating the mutation', async () => {
    const { harness, warehouseNotificationId } = await createFixture();
    const request = { idempotencyKey: nextUuid(), notificationIds: [warehouseNotificationId] };
    const first = await harness.notification.markNotificationsRead(request, SUPPLIER_1_CALL);
    expect(first.unreadCount).toBe(1);
    await revokeDealView(harness);
    harness.events.length = 0;

    const repeated = await harness.notification.markNotificationsRead(request, SUPPLIER_1_CALL);

    expect(repeated.unreadCount).toBe(0);
    expect(harness.events).toEqual([]);
  });

  it.each(['private', 'foreign', 'missing'] as const)('hides a stored notification when its deal is %s', async (visibility) => {
    const { dealId, dealNotificationId, harness, warehouseNotificationId } = await createFixture();
    await harness.runtime.command((transaction) => {
      const deal = transaction.get('deals', dealId);

      if (deal === undefined) {
        throw new Error('Expected deal fixture');
      }

      if (visibility === 'missing') {
        transaction.delete('deals', dealId);
      }
      else {
        if (visibility === 'private') {
          deal.status = DealStatus.CANCELLED;
          deal.submittedAt = undefined;
        }
        else {
          deal.supplierOrganizationId = SeedOrganizationId.SUPPLIER_2;
        }
        transaction.put('deals', deal);
      }
    });

    const listed = await harness.notification.listNotifications({}, SUPPLIER_1_CALL);
    const denied = await captureError(harness.notification.markNotificationsRead({
      idempotencyKey: nextUuid(),
      notificationIds: [dealNotificationId],
    }, SUPPLIER_1_CALL));

    expect(listed.notifications.map(notification => notification.id)).toEqual([warehouseNotificationId]);
    expect(listed.unreadCount).toBe(1);
    expect(readErrorDetail(denied).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('does not use membership in another organization or retained own notification ids after membership removal', async () => {
    const { dealNotificationId, harness } = await createFixture();
    await harness.runtime.command((transaction) => {
      for (const membership of transaction.listBy('memberships', 'userId', SeedUserId.ADMIN_2)) {
        transaction.delete('memberships', membership.id);
      }
    });

    const denied = await captureError(harness.notification.markNotificationsRead({
      idempotencyKey: nextUuid(),
      notificationIds: [dealNotificationId],
    }, callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1)));

    expect(readErrorDetail(denied).code).toBe(ErrorCode.NOT_FOUND);
    expect(harness.state.read.get('notifications', dealNotificationId)?.notification.readAt).toBeUndefined();
  });

  it('hides deal notifications when the remaining grant has only a warehouse scope', async () => {
    const { harness, warehouseNotificationId } = await createFixture();
    await harness.runtime.command((transaction) => {
      for (const membership of transaction.listBy('memberships', 'userId', SeedUserId.ADMIN_2)) {
        membership.roleAssignments.forEach((assignment) => {
          assignment.warehouseIds = [SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1];
        });
        transaction.put('memberships', membership);
      }
    });

    const listed = await harness.notification.listNotifications({}, SUPPLIER_1_CALL);

    expect(listed.notifications.map(notification => notification.id)).toEqual([warehouseNotificationId]);
    expect(listed.unreadCount).toBe(1);
  });

  it('does not admit a support session to deal notifications or mark their retained ids', async () => {
    const { dealNotificationId, harness } = await createFixture();
    const staffUserId = SeedUserId.OPERATOR_SUPPORT_ENGINEER;
    const session = await putSession(harness, {
      expiresAtMs: harness.clock.now() + 60_000,
      id: nextUuid(),
      organizationId: SeedOrganizationId.SUPPLIER_1,
      staffUserId,
      status: SupportAccessStatus.ACTIVE,
    });
    const options = callAs(staffUserId, SeedOrganizationId.SUPPLIER_1);
    const headers = new Headers(options.headers);
    headers.set(SUPPORT_SESSION_HEADER, session.id);
    await harness.runtime.command((transaction) => {
      const retained = transaction.get('notifications', dealNotificationId);

      if (retained !== undefined) {
        retained.userId = staffUserId;
        transaction.put('notifications', retained);
      }
    });

    for (const request of [
      harness.notification.listNotifications({}, { headers }),
      harness.notification.getDigest({}, { headers }),
    ]) {
      expect(readErrorDetail(await captureError(request)).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    }

    const denied = await captureError(harness.notification.markNotificationsRead({
      idempotencyKey: nextUuid(),
      notificationIds: [dealNotificationId],
    }, { headers }));
    const marked = await harness.notification.markAllNotificationsRead({ idempotencyKey: nextUuid() }, { headers });

    expect(readErrorDetail(denied).code).toBe(ErrorCode.NOT_FOUND);
    expect(marked.unreadCount).toBe(0);
    expect(harness.state.read.get('notifications', dealNotificationId)?.notification.readAt).toBeUndefined();
  });
});
