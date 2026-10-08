import type { ReactElement } from 'react';

import {
  parseApiError,
  translateApiError,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import { SECONDARY_BUTTON_CLASS_NAME } from './buttonStyles';

interface QueryErrorNoticeProps {
  error: Error | null;
  onRetry: () => void;
}

export const QueryErrorNotice = ({ error, onRetry }: QueryErrorNoticeProps): ReactElement => {
  const { t } = useI18n();

  const message = translateApiError(t, parseApiError(error));

  const handleRetryClick = (): void => {
    console.log('> QueryErrorNotice -> handleRetryClick:', { message });
    onRetry();
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert">{message}</p>
      <button className={SECONDARY_BUTTON_CLASS_NAME} onClick={handleRetryClick} type="button">
        {t('common.retry')}
      </button>
    </div>
  );
};
