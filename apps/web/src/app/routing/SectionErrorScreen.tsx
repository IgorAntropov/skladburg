import type { ReactElement } from 'react';

import { useState } from 'react';

import { useI18n } from '@/shared/i18n';
import { useReloadPage } from '@/shared/routing';
import {
  Button,
  StatusScreen,
} from '@/shared/ui';

import { SectionChunkLoadError } from './SectionChunkLoadError';

interface SectionErrorScreenProps {
  error: Error;
  onReset: () => void;
}

export const SectionErrorScreen = ({ error, onReset }: SectionErrorScreenProps): ReactElement => {
  const { t } = useI18n();
  const reloadPage = useReloadPage();

  const [resetCount, setResetCount] = useState(0);

  const isChunkError = error instanceof SectionChunkLoadError;
  const message = isChunkError ? t('routing.chunkError.message') : t('routing.renderError.message');

  const handleRetryClick = (): void => {
    console.log('> SectionErrorScreen -> handleRetryClick:', { isChunkError, resetCount });
    if (isChunkError) {
      reloadPage();
      return;
    }
    setResetCount(count => count + 1);
    onReset();
  };

  const retryAction = (
    <Button onClick={handleRetryClick} size="lg">
      {t('common.retry')}
    </Button>
  );

  return <StatusScreen action={retryAction} announceKey={resetCount} layout="section" title={message} tone="error" />;
};
