import type { Notification } from '@skladburg/contracts/notification/v1/notification';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { useEffect } from 'react';

import type { DateTimeFormatPartsValue } from '@/shared/i18n';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import { Button } from '@/shared/ui';

import type { NotificationCenterTabValue } from '../../lib/notificationCenterTabs';
import type { NotificationTranslate } from './formatNotificationMessage';

import { formatNotificationMessage } from './formatNotificationMessage';
import { NotificationKindIcon } from './NotificationKindIcon';

interface NotificationRowProps {
  notification: Notification;
  onLinkClick: () => void;
  onTabRequest?: ((tab: NotificationCenterTabValue) => void) | undefined;
  t: NotificationTranslate;
}

const loadRowActions = createCachedModuleLoader(() => import('./NotificationRowActions'));

const TIME_FORMAT: DateTimeFormatPartsValue = { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' };

const ROW_CLASS_NAME = 'flex gap-3 border-b border-line pt-3 pr-4 pl-3 last:border-b-0';

const ICON_CLASS_NAME = 'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-hover';

const UNREAD_DOT_CLASS_NAME = 'absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-on-panel ring-2 ring-panel-solid';

export const NotificationRow = ({ notification, onLinkClick, onTabRequest, t }: NotificationRowProps): ReactElement => {
  const { createSectionTranslator, formatDateTime, t: mainT, userTimeZone } = useI18n();
  const { load, state } = useChunkLoader(loadRowActions);

  const isUnread = notification.readAt === undefined;
  const sensorAlert = notification.params.case === 'warehouseSensorAlert' ? notification.params.value : undefined;
  const occurredAt = sensorAlert?.resolvedAt ?? sensorAlert?.openedAt ?? notification.createdAt;
  const occurredAtMs = occurredAt === undefined ? undefined : timestampMs(occurredAt);
  const timeText = occurredAtMs === undefined ? '' : formatDateTime(occurredAtMs, { format: TIME_FORMAT, timeZone: userTimeZone });
  const formatTime = (instantMs: number): string => formatDateTime(instantMs, { timeZone: userTimeZone });
  const isChatOpenable = notification.params.case === 'supportReply' && onTabRequest !== undefined;
  const hasActions = notification.links.length > 0 || isChatOpenable;
  const RowActions = state.kind === 'loaded' ? state.module.NotificationRowActions : undefined;
  const isActionsError = hasActions && state.kind === 'failed';
  const dateTimeValue = occurredAtMs === undefined ? undefined : new Date(occurredAtMs).toISOString();

  useEffect(() => {
    if (hasActions) {
      load();
    }
  }, [hasActions, load]);

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
          {formatNotificationMessage(t, formatTime, createSectionTranslator, notification)}
        </p>
        {dateTimeValue !== undefined && (
          <time className="text-sm leading-5 text-on-panel-muted" dateTime={dateTimeValue}>{timeText}</time>
        )}
        {hasActions && RowActions !== undefined && (
          <RowActions notification={notification} onLinkClick={onLinkClick} onTabRequest={onTabRequest} t={t} />
        )}
        {isActionsError && <Button onClick={load} variant="link">{mainT('common.retry')}</Button>}
      </div>
    </li>
  );
};
