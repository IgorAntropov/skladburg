import type { ReactElement } from 'react';

import type { SectionStatus } from '@/shared/i18n';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui';

import { RequisitesFieldsSkeleton } from './RequisitesFieldsSkeleton';

export interface RequisitesPanelFallbackProps {
  onRetry: () => void;
  status: SectionStatus;
}

export const RequisitesPanelFallback = ({ onRetry, status }: RequisitesPanelFallbackProps): ReactElement => {
  const { t } = useI18n();

  const handleRetryClick = (): void => {
    console.log('> RequisitesPanelFallback -> handleRetryClick:', { status });
    onRetry();
  };

  if (status === 'error') {
    return (
      <div className="flex max-w-prose flex-col items-start gap-3">
        <p className="text-base leading-6" role="alert">{t('routing.chunkError.message')}</p>
        <Button onClick={handleRetryClick} variant="secondary">{t('common.retry')}</Button>
      </div>
    );
  }

  return <RequisitesFieldsSkeleton />;
};
