import type { ReactElement } from 'react';

import { MonitorDown } from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { DropdownMenuItem } from '@/shared/ui';

import { useInstallApp } from '../model/useInstallApp';
import { useIsInstallAppAvailable } from '../model/useIsInstallAppAvailable';

interface InstallAppMenuItemProps {
  onInstructionsRequest: () => void;
}

export const InstallAppMenuItem = ({ onInstructionsRequest }: InstallAppMenuItemProps): null | ReactElement => {
  const { t } = useI18n();
  const { mode, prompt } = useInstallApp();
  const isAvailable = useIsInstallAppAvailable();

  const handleInstallSelect = (): void => {
    console.log('> InstallAppMenuItem -> handleInstallSelect:', { mode });
    if (mode === 'prompt') {
      void prompt();

      return;
    }
    onInstructionsRequest();
  };

  if (!isAvailable) {
    return null;
  }

  return (
    <DropdownMenuItem onSelect={handleInstallSelect}>
      <MonitorDown aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
      {t('install.menuItem')}
    </DropdownMenuItem>
  );
};
