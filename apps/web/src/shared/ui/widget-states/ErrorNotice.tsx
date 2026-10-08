import type { ReactElement } from 'react';

import { TriangleAlert } from 'lucide-react';

import {
  parseApiError,
  translateApiError,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import { Button } from '../button/Button';

const ERROR_BADGE_CLASS_NAME = 'flex size-6 shrink-0 items-center justify-center rounded-full bg-status-alarm text-on-status-alarm';

export interface ErrorNoticeProps {
  announceKey?: number | string | undefined;
  error: Error | null;
  isRetrying?: boolean | undefined;
  onRetry?: (() => void) | undefined;
}

export const ErrorNotice = ({ announceKey, error, isRetrying = false, onRetry }: ErrorNoticeProps): ReactElement => {
  const { t } = useI18n();

  const message = translateApiError(t, parseApiError(error));

  const handleRetryClick = (): void => {
    console.log('> ErrorNotice -> handleRetryClick:', { message });
    onRetry?.();
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-start gap-2">
        <span aria-hidden className={ERROR_BADGE_CLASS_NAME}>
          <TriangleAlert className="size-4" />
        </span>
        <p className="text-base leading-6" key={announceKey} role="alert">{message}</p>
      </div>
      {onRetry !== undefined && (
        <Button onClick={handleRetryClick} pending={isRetrying} pendingLabel={t('common.retrying')} variant="secondary">
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
};
