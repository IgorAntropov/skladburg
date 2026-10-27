import type { ReactElement } from 'react';

import { AssistantPortrait } from '@/entities/assistant';

import type { NotificationTranslate } from '../../lib/formatNotificationMessage';

interface NotificationEmptyProps {
  t: NotificationTranslate;
}

export const NotificationEmpty = ({ t }: NotificationEmptyProps): ReactElement => {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-7 text-center">
      <AssistantPortrait size="md" />
      <p className="text-base font-semibold">{t('notification.panel.empty.title')}</p>
      <p className="text-sm text-pretty text-on-panel-muted">{t('notification.panel.empty.hint')}</p>
    </div>
  );
};
