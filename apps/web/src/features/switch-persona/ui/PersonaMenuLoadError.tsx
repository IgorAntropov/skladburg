import type { ReactElement } from 'react';

import { useEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  DropdownMenuItem,
  useAnnounce,
} from '@/shared/ui';

interface PersonaMenuLoadErrorProps {
  onRetry: () => void;
}

export const PersonaMenuLoadError = ({ onRetry }: PersonaMenuLoadErrorProps): ReactElement => {
  const { t } = useI18n();
  const announce = useAnnounce();

  const statusMessage = t('persona.loadError.status');

  const handleRetrySelect = (): void => {
    console.log('> PersonaMenuLoadError -> handleRetrySelect:', {});
    onRetry();
  };

  useEffect(() => {
    announce(statusMessage);
  }, [announce, statusMessage]);

  return <DropdownMenuItem onSelect={handleRetrySelect}>{t('persona.loadError.retry')}</DropdownMenuItem>;
};
