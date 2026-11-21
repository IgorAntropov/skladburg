import type { Notification } from '@skladburg/contracts/notification/v1/notification';
import type { ReactElement } from 'react';

import { useMemo } from 'react';

import type { NotificationLinkKind } from '@/entities/notification';

import {
  resolveNotificationLinks,
  useMarkNotificationsRead,
} from '@/entities/notification';
import {
  Button,
  TextLink,
} from '@/shared/ui';

import type { NotificationCenterTabValue } from '../../lib/notificationCenterTabs';
import type { NotificationTranslate } from './formatNotificationMessage';

export interface NotificationRowActionsProps {
  notification: Notification;
  onLinkClick: () => void;
  onTabRequest?: ((tab: NotificationCenterTabValue) => void) | undefined;
  t: NotificationTranslate;
}

const LINK_LABEL_KEY_BY_KIND = {
  map: 'notification.link.map',
  open: 'notification.link.open',
  organization: 'notification.link.organization',
} as const satisfies Record<NotificationLinkKind, string>;

export const NotificationRowActions = ({ notification, onLinkClick, onTabRequest, t }: NotificationRowActionsProps): ReactElement => {
  const markRead = useMarkNotificationsRead([notification.id]);
  const links = useMemo(() => resolveNotificationLinks(notification.links), [notification.links]);
  const isUnread = notification.readAt === undefined;
  const isChatOpenable = notification.params.case === 'supportReply' && onTabRequest !== undefined;

  const handleLinkClick = (): void => {
    console.log('> NotificationRowActions -> handleLinkClick:', { isUnread, notificationId: notification.id });
    if (isUnread) {
      markRead.run();
    }
    onLinkClick();
  };

  const handleOpenChatClick = (): void => {
    console.log('> NotificationRowActions -> handleOpenChatClick:', { notificationId: notification.id });
    if (isUnread) {
      markRead.run();
    }
    onTabRequest?.('help');
  };

  return (
    <div className="flex flex-wrap gap-x-4">
      {links.map(link => (
        <TextLink
          data-testid={`notification-center-link-${link.kind}`}
          isFocusRequested={link.isFocusRequested}
          key={link.id}
          onClick={handleLinkClick}
          size="sm"
          to={link.address}
        >
          {t(LINK_LABEL_KEY_BY_KIND[link.kind])}
        </TextLink>
      ))}
      {isChatOpenable && (
        <Button
          data-testid="notification-center-link-open-chat"
          onClick={handleOpenChatClick}
          variant="link"
        >
          {t('notification.link.openChat')}
        </Button>
      )}
    </div>
  );
};
