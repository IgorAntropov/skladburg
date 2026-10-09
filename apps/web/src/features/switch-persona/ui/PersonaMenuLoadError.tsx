import type { ReactElement } from 'react';

import {
  useEffect,
  useRef,
} from 'react';

import { useI18n } from '@/shared/i18n';
import {
  DropdownMenuItem,
  useAnnounce,
} from '@/shared/ui';

const MENU_SELECTOR = '[role="menu"]';

interface PersonaMenuLoadErrorProps {
  onRetry: () => void;
}

export const PersonaMenuLoadError = ({ onRetry }: PersonaMenuLoadErrorProps): ReactElement => {
  const { t } = useI18n();
  const announce = useAnnounce();
  const menuToRefocusRef = useRef<HTMLElement | null>(null);

  const statusMessage = t('persona.loadError.status');

  const handleRetrySelect = (event: Event): void => {
    console.log('> PersonaMenuLoadError -> handleRetrySelect:', {});
    event.preventDefault();
    menuToRefocusRef.current = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(MENU_SELECTOR) : null;
    onRetry();
  };

  useEffect(() => {
    announce(statusMessage);
  }, [announce, statusMessage]);

  useEffect(() => {
    return () => {
      const menu = menuToRefocusRef.current;

      menuToRefocusRef.current = null;
      queueMicrotask(() => {
        if (menu?.isConnected === true && document.activeElement === document.body) {
          menu.focus({ preventScroll: true });
        }
      });
    };
  }, []);

  return <DropdownMenuItem onSelect={handleRetrySelect}>{t('persona.loadError.retry')}</DropdownMenuItem>;
};
