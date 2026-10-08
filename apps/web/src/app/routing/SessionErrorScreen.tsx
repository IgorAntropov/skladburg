import type { ReactElement } from 'react';

import { useState } from 'react';

import {
  parseApiError,
  translateApiError,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  Button,
  StatusScreen,
} from '@/shared/ui';

interface SessionErrorScreenProps {
  error: Error;
  isRetrying: boolean;
  onRetry: () => void;
}

export const SessionErrorScreen = ({ error, isRetrying, onRetry }: SessionErrorScreenProps): ReactElement => {
  const { t } = useI18n();

  const [prevIsRetrying, setPrevIsRetrying] = useState(isRetrying);
  const [finishedAttemptCount, setFinishedAttemptCount] = useState(0);

  const message = translateApiError(t, parseApiError(error));

  if (prevIsRetrying !== isRetrying) {
    setPrevIsRetrying(isRetrying);
    if (prevIsRetrying) {
      setFinishedAttemptCount(count => count + 1);
    }
  }

  const handleRetryClick = (): void => {
    console.log('> SessionErrorScreen -> handleRetryClick:', { isRetrying, message });
    onRetry();
  };

  const retryAction = (
    <Button onClick={handleRetryClick} pending={isRetrying} pendingLabel={t('common.retrying')} size="lg">
      {t('common.retry')}
    </Button>
  );

  return <StatusScreen action={retryAction} announceKey={finishedAttemptCount} layout="section" title={message} tone="error" />;
};
