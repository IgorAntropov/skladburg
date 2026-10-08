import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  Button,
  ErrorNotice,
} from '@/shared/ui';

import { useResetDemoMutation } from '../api/useResetDemoMutation';

export const ResetDemoButton = (): ReactElement => {
  const { t } = useI18n();
  const {
    error,
    isError,
    isPending,
    mutate,
    submittedAt,
  } = useResetDemoMutation();

  const handleResetClick = (): void => {
    console.log('> ResetDemoButton -> handleResetClick:', { isPending });
    mutate();
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        onClick={handleResetClick}
        pending={isPending}
        pendingLabel={t('warehouse.resetDemo.pending')}
        variant="secondary"
      >
        {t('warehouse.resetDemo.label')}
      </Button>
      {isError && <ErrorNotice announceKey={submittedAt} error={error} />}
    </div>
  );
};
