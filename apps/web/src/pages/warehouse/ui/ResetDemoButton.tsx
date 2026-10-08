import type { ReactElement } from 'react';

import {
  parseApiError,
  translateApiError,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import { useResetDemoMutation } from '../api/useResetDemoMutation';
import { PRIMARY_BUTTON_CLASS_NAME } from './buttonStyles';

export const ResetDemoButton = (): ReactElement => {
  const { t } = useI18n();
  const {
    error,
    isError,
    isPending,
    mutate,
  } = useResetDemoMutation();

  const label = isPending ? t('warehouse.resetDemo.pending') : t('warehouse.resetDemo.label');
  const errorMessage = isError ? translateApiError(t, parseApiError(error)) : undefined;

  const handleResetClick = (): void => {
    console.log('> ResetDemoButton -> handleResetClick:', { isPending });
    if (isPending) {
      return;
    }
    mutate();
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        aria-busy={isPending}
        className={PRIMARY_BUTTON_CLASS_NAME}
        disabled={isPending}
        onClick={handleResetClick}
        type="button"
      >
        {label}
      </button>
      {errorMessage !== undefined && <p role="alert">{errorMessage}</p>}
    </div>
  );
};
