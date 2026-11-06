import type { ReactElement } from 'react';

import type { ButtonVariantValue } from '@/shared/ui';

import { Button } from '@/shared/ui';
import { ChunkLoadNotice } from '@/shared/ui';

import type { EditLauncherValue } from '../model/useEditLauncher';

import { useCatalogTexts } from '../model/useCatalogTexts';

interface EditLauncherButtonProps {
  'data-testid': string;
  'failureMessage': string;
  'label': string;
  'launcher': EditLauncherValue<unknown>;
  'variant'?: ButtonVariantValue | undefined;
}

export const EditLauncherButton = ({
  'data-testid': testId,
  failureMessage,
  label,
  launcher,
  variant = 'secondary',
}: EditLauncherButtonProps): ReactElement => {
  const { t } = useCatalogTexts();

  const { buttonRef, isLoading, loadRecovery, open, warmUp } = launcher;

  const handleClick = (): void => {
    console.log('> EditLauncherButton -> handleClick:', { testId });
    open();
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        data-testid={testId}
        onClick={handleClick}
        onFocus={warmUp}
        onPointerEnter={warmUp}
        pending={isLoading}
        pendingLabel={t('catalog.own.opening')}
        ref={buttonRef}
        variant={variant}
      >
        {label}
      </Button>
      {loadRecovery !== undefined && (
        <ChunkLoadNotice
          message={failureMessage}
          onRetry={open}
          recovery={loadRecovery}
          repeatedMessage={t('catalog.chunkError.repeated')}
        />
      )}
    </div>
  );
};
