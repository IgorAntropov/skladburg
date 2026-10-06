import type { ReactElement } from 'react';

import { useState } from 'react';

import { useI18n } from '@/shared/i18n';

const RETRY_BUTTON_CLASS_NAME = [
  'min-h-12 rounded-md bg-primary px-6 py-2 text-base font-medium text-on-primary',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
  'disabled:opacity-60',
].join(' ');

interface StartErrorScreenProps {
  onRetry: () => Promise<void>;
}

export const StartErrorScreen = ({ onRetry }: StartErrorScreenProps): ReactElement => {
  const { t } = useI18n();

  const [isRetrying, setIsRetrying] = useState(false);

  const retryLabel = isRetrying ? t('app.startError.retrying') : t('app.startError.retry');

  const retry = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await onRetry();
    }
    finally {
      setIsRetrying(false);
    }
  };

  const handleRetryClick = (): void => {
    console.log('> StartErrorScreen -> handleRetryClick:', { isRetrying });
    if (isRetrying) {
      return;
    }
    void retry();
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-4 text-center text-on-surface">
      <p className="text-balance text-lg" role="alert">
        {t('app.startError.message')}
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
    </main>
  );
};
