import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { useReloadPage } from '@/shared/routing';

import { RETRY_BUTTON_CLASS_NAME } from '../lib/retryButtonClassName';

export const SectionErrorScreen = (): ReactElement => {
  const { t } = useI18n();
  const reloadPage = useReloadPage();

  const handleRetryClick = (): void => {
    console.log('> SectionErrorScreen -> handleRetryClick:', {});
    reloadPage();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-8">
      <p className="text-balance text-lg" role="alert">
        {t('routing.chunkError.message')}
      </p>
      <button className={RETRY_BUTTON_CLASS_NAME} onClick={handleRetryClick} type="button">
        {t('common.retry')}
      </button>
    </div>
  );
};
