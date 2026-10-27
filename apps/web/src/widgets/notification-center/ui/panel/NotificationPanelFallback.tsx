import type { ReactElement } from 'react';

import type { SectionStatus } from '@/shared/i18n';

import { useI18n } from '@/shared/i18n';
import {
  Button,
  SkeletonGroup,
} from '@/shared/ui';

import { NotificationListSkeleton } from './NotificationListSkeleton';

interface NotificationPanelFallbackProps {
  onRetry: () => void;
  status: SectionStatus;
}

export const NotificationPanelFallback = ({ onRetry, status }: NotificationPanelFallbackProps): ReactElement => {
  const { t } = useI18n();

  if (status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-base leading-6" role="alert">{t('hud.notifications.loadError')}</p>
        <Button onClick={onRetry} variant="secondary">{t('common.retry')}</Button>
      </div>
    );
  }

  return (
    <SkeletonGroup isFilled label={t('hud.notifications.button')}>
      <NotificationListSkeleton />
    </SkeletonGroup>
  );
};
