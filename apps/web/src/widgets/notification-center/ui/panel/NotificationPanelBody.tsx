import type { ReactElement } from 'react';

import { useNotificationsQuery } from '@/entities/notification';
import { WidgetStates } from '@/shared/ui';

import type { NotificationTranslate } from '../../lib/formatNotificationMessage';

import { NotificationEmpty } from './NotificationEmpty';
import { NotificationListSkeleton } from './NotificationListSkeleton';
import { NotificationPanelHeader } from './NotificationPanelHeader';
import { NotificationRow } from './NotificationRow';

interface NotificationPanelBodyProps {
  onLinkClick: () => void;
  t: NotificationTranslate;
}

const SCROLL_AREA_CLASS_NAME = 'scroll-shadow-y min-h-0 overflow-y-auto overscroll-contain has-[[role=alert]]:p-4';

export const NotificationPanelBody = ({ onLinkClick, t }: NotificationPanelBodyProps): ReactElement => {
  const { data, error, isError, isRefetching, refetch } = useNotificationsQuery();

  const isRetrying = isRefetching && isError;
  const unreadCount = data?.unreadCount ?? 0;

  const handleRetryClick = (): void => {
    console.log('> NotificationPanelBody -> handleRetryClick:', {});
    void refetch();
  };

  return (
    <>
      <NotificationPanelHeader t={t} unreadCount={unreadCount} />
      <div className={SCROLL_AREA_CLASS_NAME}>
        <WidgetStates
          data={data}
          empty={<NotificationEmpty t={t} />}
          error={error}
          isEmpty={response => response.notifications.length === 0}
          isRetrying={isRetrying}
          loadingLabel={t('notification.panel.loading')}
          onRetry={handleRetryClick}
          skeleton={<NotificationListSkeleton />}
        >
          {response => (
            <ul>
              {response.notifications.map(notification => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onLinkClick={onLinkClick}
                  t={t}
                />
              ))}
            </ul>
          )}
        </WidgetStates>
      </div>
    </>
  );
};
