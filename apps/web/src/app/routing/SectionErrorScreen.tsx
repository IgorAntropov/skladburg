import type { ReactElement } from 'react';

import { useState } from 'react';

import { useI18n } from '@/shared/i18n';
import { getChunkRecovery } from '@/shared/lib/module-loader';
import { useReloadPage } from '@/shared/routing';
import {
  Button,
  StatusScreen,
} from '@/shared/ui';

import { SectionChunkLoadError } from './SectionChunkLoadError';
import { useSectionRetry } from './useSectionRetry';

interface SectionErrorScreenProps {
  error: Error;
  onReset: () => void;
}

export const SectionErrorScreen = ({ error, onReset }: SectionErrorScreenProps): ReactElement => {
  const { t } = useI18n();
  const reloadPage = useReloadPage();
  const retrySection = useSectionRetry();

  const [resetCount, setResetCount] = useState(0);

  const chunkSection = error instanceof SectionChunkLoadError ? error.section : undefined;
  const isChunkError = chunkSection !== undefined;
  const isReloadNeeded = isChunkError && getChunkRecovery(error) === 'reload';

  const handleRetryClick = (): void => {
    console.log('> SectionErrorScreen -> handleRetryClick:', { isChunkError, resetCount });
    if (chunkSection !== undefined) {
      retrySection(chunkSection);
    }
    setResetCount(count => count + 1);
    onReset();
  };

  const handleReloadClick = (): void => {
    console.log('> SectionErrorScreen -> handleReloadClick:', { section: chunkSection });
    reloadPage();
  };

  let message = t('routing.renderError.message');
  if (isChunkError) {
    message = isReloadNeeded ? t('routing.chunkError.repeated') : t('routing.chunkError.message');
  }

  const action = isReloadNeeded
    ? (
        <Button onClick={handleReloadClick} size="lg">
          {t('routing.chunkError.reload')}
        </Button>
      )
    : (
        <Button onClick={handleRetryClick} size="lg">
          {t('common.retry')}
        </Button>
      );

  return <StatusScreen action={action} announceKey={resetCount} layout="section" title={message} tone="error" />;
};
