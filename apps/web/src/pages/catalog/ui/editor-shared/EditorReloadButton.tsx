import type { ReactElement } from 'react';

import { Button } from '@/shared/ui';

import { useEditorTexts } from '../../model/useEditorTexts';

interface EditorReloadButtonProps {
  isReloading: boolean;
  onReload: () => void;
  testId: string;
}

export const EditorReloadButton = ({ isReloading, onReload, testId }: EditorReloadButtonProps): ReactElement => {
  const t = useEditorTexts();

  const handleClick = (): void => {
    console.log('> EditorReloadButton -> handleClick:', { testId });
    onReload();
  };

  return (
    <Button
      data-testid={testId}
      onClick={handleClick}
      pending={isReloading}
      pendingLabel={t('catalogEditor.reloading')}
      variant="secondary"
    >
      {t('catalogEditor.reload')}
    </Button>
  );
};
