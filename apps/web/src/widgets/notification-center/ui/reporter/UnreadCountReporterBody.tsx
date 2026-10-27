import { useEffect } from 'react';

import { useUnreadNotificationCount } from '@/entities/notification';

import { useReportUnreadCount } from '../../lib/unreadCountSink';

export const UnreadCountReporterBody = (): null => {
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const reportUnreadCount = useReportUnreadCount();

  useEffect(() => {
    reportUnreadCount(unreadCount);
  }, [reportUnreadCount, unreadCount]);

  useEffect(() => {
    return (): void => {
      reportUnreadCount(0);
    };
  }, [reportUnreadCount]);

  return null;
};
