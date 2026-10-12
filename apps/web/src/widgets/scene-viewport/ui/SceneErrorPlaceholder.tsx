import type { ReactElement } from 'react';

import { TriangleAlert } from 'lucide-react';

import type { ChunkRecoveryValue } from '@/shared/lib/module-loader';

import { useI18n } from '@/shared/i18n';
import { useReloadPage } from '@/shared/routing';
import { Button } from '@/shared/ui';

import { ScenePlaceholder } from './ScenePlaceholder';

interface SceneErrorPlaceholderProps {
  onRetry: () => void;
  recovery: ChunkRecoveryValue | undefined;
}

export const SceneErrorPlaceholder = ({ onRetry, recovery }: SceneErrorPlaceholderProps): ReactElement => {
  const { t } = useI18n();
  const reloadPage = useReloadPage();

  const isReloadNeeded = recovery === 'reload';

  const handleRetryClick = (): void => {
    console.log('> SceneErrorPlaceholder -> handleRetryClick:', { recovery });
    onRetry();
  };

  const handleReloadClick = (): void => {
    console.log('> SceneErrorPlaceholder -> handleReloadClick:', { recovery });
    reloadPage();
  };

  const action = isReloadNeeded
    ? <Button onClick={handleReloadClick} variant="secondary">{t('routing.chunkError.reload')}</Button>
    : <Button onClick={handleRetryClick} variant="secondary">{t('common.retry')}</Button>;

  return (
    <ScenePlaceholder
      action={action}
      icon={TriangleAlert}
      label={isReloadNeeded ? t('scene.error.repeated') : t('scene.error.message')}
      role="alert"
    />
  );
};
