import type { Notification } from '@skladburg/contracts/notification/v1/notification';

import type { SectionTranslate } from '@/shared/i18n';

import type { NotificationCatalogValue } from '../i18n/notificationSection';

export type NotificationTranslate = SectionTranslate<NotificationCatalogValue>;

export const formatNotificationMessage = (t: NotificationTranslate, { params }: Notification): string => {
  switch (params.case) {
    case 'partnerVerified': {
      const { organizationName, verificationLevel } = params.value;

      return t('notification.message.partnerVerified', { organizationName, verificationLevel });
    }
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
