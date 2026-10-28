import type { ReactElement } from 'react';

import { useMarkAllNotificationsRead } from '@/entities/notification';
import { useCommandAccess } from '@/entities/session';
import {
  ActionButton,
  CommandErrorNotice,
  useAnnounce,
} from '@/shared/ui';

import type { NotificationTranslate } from '../../lib/formatNotificationMessage';

interface NotificationPanelHeaderProps {
  t: NotificationTranslate;
  unreadCount: number;
}

export const NotificationPanelHeader = ({ t, unreadCount }: NotificationPanelHeaderProps): ReactElement => {
  const announce = useAnnounce();

  const doneMessage = t('notification.panel.markAllRead.done');

  const handleMarkAllReadSuccess = (): void => {
    console.log('> NotificationPanelHeader -> handleMarkAllReadSuccess:', { doneMessage });
    announce(doneMessage);
  };

  const command = useMarkAllNotificationsRead({ onSuccess: handleMarkAllReadSuccess });
  const access = useCommandAccess(command.method);

  const isNothingToRead = unreadCount === 0 && !command.isPending;

  return (
    <div className="shrink-0 border-b border-line">
      <div className="flex min-h-14 items-center justify-between gap-2 pr-1 pl-4">
        <h2 className="text-lg font-semibold tracking-tight">{t('notification.panel.title')}</h2>
        <ActionButton
          access={access}
          className="px-3"
          command={command}
          data-testid="notification-center-mark-all"
          errorPlacement="external"
          isDisabled={isNothingToRead}
          pendingLabel={t('notification.panel.markAllRead.pending')}
          variant="ghost"
        >
          {t('notification.panel.markAllRead')}
        </ActionButton>
      </div>
      <div className="px-4 pb-3 empty:hidden">
        <CommandErrorNotice command={command} />
      </div>
    </div>
  );
};
