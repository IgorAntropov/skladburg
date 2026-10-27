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
import { AddressLink } from '@/shared/routing';

import type { NotificationTranslate } from '../../lib/formatNotificationMessage';

import { formatNotificationMessage } from '../../lib/formatNotificationMessage';
import { NotificationKindIcon } from './NotificationKindIcon';

interface NotificationRowProps {
  notification: Notification;
  onLinkClick: () => void;
  t: NotificationTranslate;
}

const LINK_LABEL_KEY_BY_KIND = {
  map: 'notification.link.map',
  open: 'notification.link.open',
  organization: 'notification.link.organization',
} as const satisfies Record<NotificationLinkKind, string>;

const TIME_FORMAT: DateTimeFormatPartsValue = { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' };

const ROW_CLASS_NAME = 'flex gap-3 border-b border-line pt-3 pr-4 pl-3 last:border-b-0';

const ICON_CLASS_NAME = 'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-hover';

const UNREAD_DOT_CLASS_NAME = 'absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-on-panel ring-2 ring-panel-solid';

const LINK_CLASS_NAME = [
  'inline-flex min-h-11 items-center rounded-control text-sm font-medium text-link underline underline-offset-2',
  'hover:text-on-panel active:text-on-panel',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
].join(' ');

export const NotificationRow = ({ notification, onLinkClick, t }: NotificationRowProps): ReactElement => {
  const { formatDateTime, userTimeZone } = useI18n();
  const markRead = useMarkNotificationsRead([notification.id]);

  const isUnread = notification.readAt === undefined;
  const links = useMemo(() => resolveNotificationLinks(notification.links), [notification.links]);
  const createdAtMs = notification.createdAt === undefined ? undefined : timestampMs(notification.createdAt);
  const timeText = createdAtMs === undefined ? '' : formatDateTime(createdAtMs, { format: TIME_FORMAT, timeZone: userTimeZone });
  const dateTimeValue = createdAtMs === undefined ? undefined : new Date(createdAtMs).toISOString();

  const handleLinkClick = (): void => {
    console.log('> NotificationRow -> handleLinkClick:', { isUnread, notificationId: notification.id });
    if (isUnread) {
      markRead.run();
    }
    onLinkClick();
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
          {formatNotificationMessage(t, notification)}
        </p>
        {dateTimeValue !== undefined && (
          <time className="text-sm leading-5 text-on-panel-muted" dateTime={dateTimeValue}>{timeText}</time>
        )}
        {links.length > 0 && (
          <div className="flex flex-wrap gap-x-4">
            {links.map(link => (
              <AddressLink
                className={LINK_CLASS_NAME}
                data-testid={`notification-center-link-${link.kind}`}
                isFocusRequested={link.isFocusRequested}
                key={link.id}
                onClick={handleLinkClick}
                to={link.address}
              >
                {t(LINK_LABEL_KEY_BY_KIND[link.kind])}
              </AddressLink>
            ))}
          </div>
        )}
      </div>
    </li>
  );
};
