import type { Notification } from '@skladburg/contracts/notification/v1/notification';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { useMemo } from 'react';

import type { NotificationLinkKind } from '@/entities/notification';
import type { DateTimeFormatPartsValue } from '@/shared/i18n';

import {
  resolveNotificationLinks,
  useMarkNotificationsRead,
} from '@/entities/notification';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  TextLink,
} from '@/shared/ui';

import type { NotificationTranslate } from '../../lib/formatNotificationMessage';
import type { NotificationCenterTabValue } from '../../lib/notificationCenterTabs';

import { formatNotificationMessage } from '../../lib/formatNotificationMessage';
import { NotificationKindIcon } from './NotificationKindIcon';

interface NotificationRowProps {
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

const OPEN_CHAT_BUTTON_CLASS_NAME = '-mx-1 px-1! text-sm font-medium text-link underline underline-offset-2';

const TIME_FORMAT: DateTimeFormatPartsValue = { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' };

const ROW_CLASS_NAME = 'flex gap-3 border-b border-line pt-3 pr-4 pl-3 last:border-b-0';

const ICON_CLASS_NAME = 'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-hover';

const UNREAD_DOT_CLASS_NAME = 'absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-on-panel ring-2 ring-panel-solid';

export const NotificationRow = ({ notification, onLinkClick, onTabRequest, t }: NotificationRowProps): ReactElement => {
  const { formatDateTime, userTimeZone } = useI18n();
  const markRead = useMarkNotificationsRead([notification.id]);

  const isUnread = notification.readAt === undefined;
  const links = useMemo(() => resolveNotificationLinks(notification.links), [notification.links]);
  const createdAtMs = notification.createdAt === undefined ? undefined : timestampMs(notification.createdAt);
  const timeText = createdAtMs === undefined ? '' : formatDateTime(createdAtMs, { format: TIME_FORMAT, timeZone: userTimeZone });
  const formatTime = (instantMs: number): string => formatDateTime(instantMs, { timeZone: userTimeZone });
  const isChatOpenable = notification.params.case === 'supportReply' && onTabRequest !== undefined;
  const hasActions = links.length > 0 || isChatOpenable;
  const dateTimeValue = createdAtMs === undefined ? undefined : new Date(createdAtMs).toISOString();

  const handleLinkClick = (): void => {
    console.log('> NotificationRow -> handleLinkClick:', { isUnread, notificationId: notification.id });
    if (isUnread) {
      markRead.run();
    }
    onLinkClick();
  };

  const handleOpenChatClick = (): void => {
    console.log('> NotificationRow -> handleOpenChatClick:', { notificationId: notification.id });
    if (isUnread) {
      markRead.run();
    }
    onTabRequest?.('help');
  };

  return (
    <li
      className={ROW_CLASS_NAME}
      data-state={isUnread ? 'unread' : 'read'}
      data-testid={`notification-center-row-${notification.id}`}
    >
      <span aria-hidden className={cn(ICON_CLASS_NAME, isUnread ? 'text-on-panel' : 'text-on-panel-muted')}>
        <NotificationKindIcon notification={notification} />
        {isUnread && <span className={UNREAD_DOT_CLASS_NAME} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className={cn('text-base leading-6', isUnread ? 'text-on-panel' : 'text-on-panel-muted')}>
          {isUnread && <span className="sr-only">{`${t('notification.row.unread')}. `}</span>}
          {formatNotificationMessage(t, formatTime, notification)}
        </p>
        {dateTimeValue !== undefined && (
          <time className="text-sm leading-5 text-on-panel-muted" dateTime={dateTimeValue}>{timeText}</time>
        )}
        {hasActions && (
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
                className={OPEN_CHAT_BUTTON_CLASS_NAME}
                data-testid="notification-center-link-open-chat"
                onClick={handleOpenChatClick}
                variant="ghost"
              >
                {t('notification.link.openChat')}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
};
