import type { ReactElement } from 'react';

import { Button } from '@/shared/ui';

import type { RequisitesTranslate } from '../../i18n/requisitesSection';

export interface ReloadActualButtonProps {
  isReloading: boolean;
  onReload: () => void;
  t: RequisitesTranslate;
  testId: string;
}

export const ReloadActualButton = ({
  isReloading,
  onReload,
  t,
  testId,
}: ReloadActualButtonProps): ReactElement => {
  const handleClick = (): void => {
    console.log('> ReloadActualButton -> handleClick:', { testId });
    onReload();
  };

  return (
    <Button
      data-testid={testId}
      onClick={handleClick}
      pending={isReloading}
      pendingLabel={t('requisites.reloading')}
      variant="secondary"
    >
      {t('requisites.reload')}
    </Button>
  );
};
