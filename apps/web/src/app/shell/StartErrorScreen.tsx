import type { ReactElement } from 'react';

import { useState } from 'react';

import type { ChunkRecoveryValue } from '@/shared/lib/module-loader';

import { useI18n } from '@/shared/i18n';
import { useReloadPage } from '@/shared/routing';
import {
  Button,
  StatusScreen,
} from '@/shared/ui';

interface StartErrorScreenProps {
  onRetry: () => Promise<void>;
  recovery?: ChunkRecoveryValue | undefined;
}

export const StartErrorScreen = ({ onRetry, recovery = 'retry' }: StartErrorScreenProps): ReactElement => {
  const { t } = useI18n();
  const reloadPage = useReloadPage();

  const [isRetrying, setIsRetrying] = useState(false);
  const [finishedAttemptCount, setFinishedAttemptCount] = useState(0);

  const isReloadNeeded = recovery === 'reload';

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

  const handleReloadClick = (): void => {
    console.log('> StartErrorScreen -> handleReloadClick:', { finishedAttemptCount });
    reloadPage();
  };

  const action = isReloadNeeded
    ? (
        <Button onClick={handleReloadClick} size="lg">
          {t('routing.chunkError.reload')}
        </Button>
      )
    : (
        <Button onClick={handleRetryClick} pending={isRetrying} pendingLabel={t('common.retrying')} size="lg">
          {t('common.retry')}
        </Button>
      );

  return (
    <StatusScreen
      action={action}
      announceKey={finishedAttemptCount}
      layout="app"
      title={isReloadNeeded ? t('app.startError.repeated') : t('app.startError.message')}
      tone="error"
    />
  );
};
