import type { Notification } from '@skladburg/contracts/notification/v1/notification';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { NotificationKind } from '@skladburg/contracts/notification/v1/notification';

import type { SectionTranslate } from '@/shared/i18n';

import type { NotificationCatalogValue } from '../i18n/notificationSection';

export type FormatNotificationTime = (instantMs: number) => string;

export type NotificationTranslate = SectionTranslate<NotificationCatalogValue>;

const formatSupportAccess = (
  t: NotificationTranslate,
  formatTime: FormatNotificationTime,
  { kind, params }: Notification,
): string => {
  if (params.case !== 'supportAccess') {
    return t('notification.message.unknown');
  }

  const { expiresAt, staffDisplayName, ticketNumber } = params.value;

  if (kind === NotificationKind.SUPPORT_ACCESS_REQUESTED) {
    return t('notification.message.supportAccessRequested', { ticketNumber: String(ticketNumber) });
  }

  if (kind !== NotificationKind.SUPPORT_EMERGENCY_ACCESS_STARTED) {
    return t('notification.message.unknown');
  }

  return expiresAt === undefined
    ? t('notification.message.supportEmergencyAccessStartedOpen', { staff: staffDisplayName })
    : t('notification.message.supportEmergencyAccessStarted', {
        expiresAt: formatTime(timestampMs(expiresAt)),
        staff: staffDisplayName,
      });
};

export const formatNotificationMessage = (
  t: NotificationTranslate,
  formatTime: FormatNotificationTime,
  notification: Notification,
): string => {
  const { params } = notification;

  switch (params.case) {
    case 'partnerVerified': {
      const { organizationName, verificationLevel } = params.value;

      return t('notification.message.partnerVerified', { organizationName, verificationLevel });
    }
    case 'supportAccess':
      return formatSupportAccess(t, formatTime, notification);
    case 'supportReply': {
      const { ticketNumber } = params.value;

      return t('notification.message.supportReply', { ticketNumber: String(ticketNumber) });
    }
    case undefined:
      return t('notification.message.unknown');
    case 'verificationNextLevel': {
      const { currentLevel, nextLevel } = params.value;

      return t('notification.message.verificationNextLevel', { currentLevel, nextLevel });
    }
    case 'warehouseCreated': {
      const { cityName, warehouseName } = params.value;

      return t('notification.message.warehouseCreated', { cityName, warehouseName });
    }
  }
};
