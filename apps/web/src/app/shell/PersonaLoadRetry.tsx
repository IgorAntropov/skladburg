import type { ReactElement } from 'react';

import { useEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  useAnnounce,
  useFocusHandoff,
} from '@/shared/ui';

import { PERSONA_SWITCHER_FOCUS_KEY } from './personaSwitcherFocusKey';
import { PERSONA_SWITCHER_WIDTH_CLASS_NAME } from './personaSwitcherWidth';

const RETRY_BUTTON_CLASS_NAME = cn(
  PERSONA_SWITCHER_WIDTH_CLASS_NAME,
  'h-auto justify-start py-1.5 text-left text-sm leading-snug whitespace-normal',
);

interface PersonaLoadRetryProps {
  onRetry: () => void;
}

export const PersonaLoadRetry = ({ onRetry }: PersonaLoadRetryProps): ReactElement => {
  const { t } = useI18n();
  const announce = useAnnounce();
  const { ref, requestFocus } = useFocusHandoff<HTMLButtonElement>(PERSONA_SWITCHER_FOCUS_KEY);

  const failureMessage = t('persona.loadError.status');

  const handleRetryClick = (): void => {
    console.log('> PersonaLoadRetry -> handleRetryClick:', {});
    requestFocus();
    onRetry();
  };

  useEffect(() => {
    announce(failureMessage);
  }, [announce, failureMessage]);

  return (
    <Button className={RETRY_BUTTON_CLASS_NAME} onClick={handleRetryClick} ref={ref} variant="secondary">
      {t('persona.loadError.retry')}
    </Button>
  );
};
