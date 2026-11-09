import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  Button,
  ErrorNotice,
  Skeleton,
  SkeletonGroup,
} from '@/shared/ui';

interface RecordEditorFallbackProps {
  isError: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export const RecordEditorFallback = ({ isError, onClose, onRetry }: RecordEditorFallbackProps): ReactElement => {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-start gap-3">
      {isError
        ? <ErrorNotice error={null} onRetry={onRetry} />
        : (
            <SkeletonGroup isFilled label={t('routing.section.loading')}>
              <Skeleton className="h-40 w-full" />
            </SkeletonGroup>
          )}
      <Button onClick={onClose} variant="secondary">{t('hud.inspector.close')}</Button>
    </div>
  );
};
