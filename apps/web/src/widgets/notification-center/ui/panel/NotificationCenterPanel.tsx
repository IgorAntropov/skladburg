import type {
  ReactElement,
  RefObject,
} from 'react';

import {
  useEffect,
  useRef,
} from 'react';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';

import type { NotificationCloseReasonValue } from '../../lib/notificationCloseReason';

import { notificationSection } from '../../i18n/notificationSection';
import { useNotificationDismiss } from '../../lib/useNotificationDismiss';
import { NotificationPanelBody } from './NotificationPanelBody';
import { NotificationPanelFallback } from './NotificationPanelFallback';

export interface NotificationCenterPanelProps {
  anchorRef: RefObject<HTMLElement | null>;
  id: string;
  onClose: (reason: NotificationCloseReasonValue) => void;
}

const PANEL_CLASS_NAME = [
  'absolute top-full right-0 z-20 mt-2 flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden',
  'max-h-[min(34rem,calc(100dvh-5.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))]',
  'rounded-panel border border-line bg-panel-solid text-on-panel shadow-raised outline-none',
  'origin-top-right [--menu-in-y:-0.25rem] motion-safe:animate-menu-in',
  'max-sm:right-3 max-sm:left-3 max-sm:w-auto max-sm:max-w-none max-sm:origin-top',
].join(' ');

export const NotificationCenterPanel = ({ anchorRef, id, onClose }: NotificationCenterPanelProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { retry, status, t } = useCatalogSection(notificationSection);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleLinkClick = (): void => {
    onClose('link');
  };

  useNotificationDismiss({ anchorRef, onDismiss: onClose });

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      aria-label={mainT('hud.notifications.button')}
      className={PANEL_CLASS_NAME}
      data-testid="notification-center-panel"
      id={id}
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
    >
      {t === undefined
        ? <NotificationPanelFallback onRetry={retry} status={status} />
        : <NotificationPanelBody onLinkClick={handleLinkClick} t={t} />}
    </div>
  );
};
