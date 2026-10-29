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

interface NotificationPanelLoadErrorProps {
  message: string;
  onRetry: () => void;
}

interface NotificationPanelLoadingProps {
  label: string;
}

export const NotificationPanelLoadError = ({ message, onRetry }: NotificationPanelLoadErrorProps): ReactElement => {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <p className="text-base leading-6" role="alert">{message}</p>
      <Button onClick={onRetry} variant="secondary">{t('common.retry')}</Button>
    </div>
  );
};

export const NotificationPanelLoading = ({ label }: NotificationPanelLoadingProps): ReactElement => {
  return (
    <SkeletonGroup isFilled label={label}>
      <NotificationListSkeleton />
    </SkeletonGroup>
  );
};

export const NotificationPanelFallback = ({ onRetry, status }: NotificationPanelFallbackProps): ReactElement => {
  const { t } = useI18n();

  if (status === 'error') {
    return <NotificationPanelLoadError message={t('hud.notifications.loadError')} onRetry={onRetry} />;
  }

  return <NotificationPanelLoading label={t('hud.notifications.button')} />;
};
