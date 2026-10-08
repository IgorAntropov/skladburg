import type { ReactElement } from 'react';

import { useState } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  Button,
  StatusScreen,
} from '@/shared/ui';

interface StartErrorScreenProps {
  onRetry: () => Promise<void>;
}

export const StartErrorScreen = ({ onRetry }: StartErrorScreenProps): ReactElement => {
  const { t } = useI18n();

  const [isRetrying, setIsRetrying] = useState(false);
  const [finishedAttemptCount, setFinishedAttemptCount] = useState(0);

  const retry = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await onRetry();
    }
    finally {
      setIsRetrying(false);
      setFinishedAttemptCount(count => count + 1);
    }
  };

  const handleRetryClick = (): void => {
    console.log('> StartErrorScreen -> handleRetryClick:', { finishedAttemptCount });
    void retry();
  };

  const retryAction = (
    <Button onClick={handleRetryClick} pending={isRetrying} pendingLabel={t('common.retrying')} size="lg">
      {t('common.retry')}
    </Button>
  );

  return (
    <StatusScreen
      action={retryAction}
      announceKey={finishedAttemptCount}
      layout="app"
      title={t('app.startError.message')}
      tone="error"
    />
  );
};
