import { timestampMs } from '@bufbuild/protobuf/wkt';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { getPermissionName } from '@skladburg/contracts/runtime';

import type {
  IStateReader,
  NotificationRecordValue,
} from '../../state/index';

import { resolveEffectivePermissions } from '../../access/index';
import { compareIds } from '../../state/index';
import { isDealVisibleToOrganization } from '../deals/index';

const DEAL_VIEW_PERMISSION = getPermissionName(PermissionCode.DEAL_VIEW);

const compareNewestFirst = (current: NotificationRecordValue, next: NotificationRecordValue): number => {
  const currentMs = current.notification.createdAt === undefined ? 0 : timestampMs(current.notification.createdAt);
  const nextMs = next.notification.createdAt === undefined ? 0 : timestampMs(next.notification.createdAt);

  return nextMs - currentMs || compareIds(current.notification.id, next.notification.id);
};

export const isUnread = (record: NotificationRecordValue): boolean => record.notification.readAt === undefined;

export const listUserNotifications = (
  reader: IStateReader,
  userId: string,
  organizationId: string,
): NotificationRecordValue[] => {
  const membership = reader.listBy('memberships', 'userId', userId).find(candidate => candidate.organizationId === organizationId);
  const canViewDeals = membership !== undefined && resolveEffectivePermissions(reader, membership).some(
    permission => permission.permission === DEAL_VIEW_PERMISSION && permission.isOrganizationWide,
  );

  return reader.listBy('notifications', 'userId', userId)
    .filter(({ notification }) => {
      if (notification.organizationId !== organizationId) {
        return false;
      }

      if (notification.params.case !== 'dealUpdate') {
        return true;
      }

      const deal = reader.get('deals', notification.params.value.dealId);

      return canViewDeals && deal !== undefined && isDealVisibleToOrganization(deal, organizationId);
    })
    .sort(compareNewestFirst);
};

export const countUnreadNotifications = (reader: IStateReader, userId: string, organizationId: string): number =>
  listUserNotifications(reader, userId, organizationId).filter(isUnread).length;
