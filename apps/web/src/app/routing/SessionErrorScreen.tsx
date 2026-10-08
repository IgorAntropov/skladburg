import type { ReactElement } from 'react';

import {
  parseApiError,
  translateApiError,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import { RETRY_BUTTON_CLASS_NAME } from '../lib/retryButtonClassName';

interface SessionErrorScreenProps {
  error: Error;
  isRetrying: boolean;
  onRetry: () => void;
}

export const SessionErrorScreen = ({ error, isRetrying, onRetry }: SessionErrorScreenProps): ReactElement => {
  const { t } = useI18n();

  const message = translateApiError(t, parseApiError(error));
  const retryLabel = isRetrying ? t('common.retrying') : t('common.retry');

  const handleRetryClick = (): void => {
    console.log('> SessionErrorScreen -> handleRetryClick:', { isRetrying, message });
    onRetry();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-8">
      <p className="text-balance text-lg" role="alert">
        {message}
      </p>
      <button
        aria-busy={isRetrying}
        className={RETRY_BUTTON_CLASS_NAME}
        disabled={isRetrying}
        onClick={handleRetryClick}
        type="button"
      >
        {retryLabel}
      </button>
    </div>
  );
};
