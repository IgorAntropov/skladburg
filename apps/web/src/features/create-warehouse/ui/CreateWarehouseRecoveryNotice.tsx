import type { ReactElement } from 'react';

import { TriangleAlert } from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { useReloadPage } from '@/shared/routing';
import { Button } from '@/shared/ui';

const BADGE_CLASS_NAME = 'flex size-6 shrink-0 items-center justify-center rounded-full bg-status-alarm text-on-status-alarm';

export interface CreateWarehouseRecoveryNoticeProps {
  isRetrying?: boolean | undefined;
  message: string;
  onRetry?: (() => void) | undefined;
  recovery: 'reload' | 'retry';
}

export const CreateWarehouseRecoveryNotice = ({
  isRetrying = false,
  message,
  onRetry,
  recovery,
}: CreateWarehouseRecoveryNoticeProps): ReactElement => {
  const { t } = useI18n();
  const reloadPage = useReloadPage();

  const isReload = recovery === 'reload';
  const isRetryShown = !isReload && onRetry !== undefined;

  const handleReloadClick = (): void => {
    console.log('> CreateWarehouseRecoveryNotice -> handleReloadClick:', {});
    reloadPage();
  };

  const handleRetryClick = (): void => {
    console.log('> CreateWarehouseRecoveryNotice -> handleRetryClick:', {});
    onRetry?.();
  };

  return (
    <div className="flex max-w-prose flex-col items-start gap-3">
      <div className="flex items-start gap-2">
        <span aria-hidden className={BADGE_CLASS_NAME}>
          <TriangleAlert className="size-4" />
        </span>
        <p className="text-base leading-6" role="alert">{message}</p>
      </div>
      {isReload && <Button onClick={handleReloadClick} variant="secondary">{t('routing.chunkError.reload')}</Button>}
      {isRetryShown && (
        <Button onClick={handleRetryClick} pending={isRetrying} pendingLabel={t('common.retrying')} variant="secondary">
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
};
