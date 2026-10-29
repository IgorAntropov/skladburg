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
import { cn } from '@/shared/lib/cn';
import { Tabs } from '@/shared/ui';

import type {
  NotificationCenterTabValue,
  NotificationTabRequestValue,
  RenderNotificationHelpTab,
} from '../../lib/notificationCenterTabs';
import type { NotificationCloseReasonValue } from '../../lib/notificationCloseReason';

import { notificationSection } from '../../i18n/notificationSection';
import { useNotificationDismiss } from '../../lib/useNotificationDismiss';
import { NotificationPanelBody } from './NotificationPanelBody';
import {
  NotificationPanelFallback,
  NotificationPanelLoadError,
  NotificationPanelLoading,
} from './NotificationPanelFallback';

export interface NotificationCenterPanelProps {
  anchorRef: RefObject<HTMLElement | null>;
  id: string;
  onClose: (reason: NotificationCloseReasonValue) => void;
  onTabRequest: (tab: NotificationCenterTabValue) => void;
  renderHelpTab?: RenderNotificationHelpTab | undefined;
  tabRequest: NotificationTabRequestValue;
}

const PANEL_CLASS_NAME = [
  'absolute top-full right-0 z-20 mt-2 flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden',
  'max-h-[min(34rem,calc(100dvh-5.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))]',
  'rounded-panel border border-line bg-panel-solid text-on-panel shadow-raised outline-none',
  'origin-top-right [--menu-in-y:-0.25rem] motion-safe:animate-menu-in',
  'max-sm:right-3 max-sm:left-3 max-sm:w-auto max-sm:max-w-none max-sm:origin-top',
].join(' ');

const NOTIFICATIONS_TAB_CLASS_NAME = '-m-3 flex min-h-0 flex-1 flex-col';

export const NotificationCenterPanel = ({
  anchorRef,
  id,
  onClose,
  onTabRequest,
  renderHelpTab,
  tabRequest,
}: NotificationCenterPanelProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { retry, status, t } = useCatalogSection(notificationSection);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleLinkClick = (): void => {
    onClose('link');
  };

  useNotificationDismiss({ anchorRef, onDismiss: onClose });

  const helpTab = t === undefined
    ? undefined
    : renderHelpTab?.({
        loadingFallback: <NotificationPanelLoading label={t('notification.help.loading')} />,
        renderLoadError: onRetry => <NotificationPanelLoadError message={t('notification.help.loadError')} onRetry={onRetry} />,
      });
  const isTabbed = helpTab !== undefined;

  const renderContent = (): ReactElement => {
    if (t === undefined) {
      return <NotificationPanelFallback onRetry={retry} status={status} />;
    }

    if (!isTabbed) {
      return <NotificationPanelBody isTitleShown onLinkClick={handleLinkClick} t={t} />;
    }

    return (
      <Tabs
        defaultTabId={tabRequest.tab}
        items={[
          {
            content: (
              <div className={NOTIFICATIONS_TAB_CLASS_NAME}>
                <NotificationPanelBody isTitleShown={false} onLinkClick={handleLinkClick} onTabRequest={onTabRequest} t={t} />
              </div>
            ),
            id: 'notifications',
            label: t('notification.tab.notifications'),
          },
          { content: helpTab, id: 'help', label: t('notification.tab.help') },
        ]}
        key={tabRequest.request}
        label={t('notification.tabs.label')}
      />
    );
  };

  const panelLabel = isTabbed ? mainT('assistant.name') : mainT('hud.notifications.button');
  const panelClassName = cn(PANEL_CLASS_NAME, isTabbed && 'min-h-76');

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      aria-label={panelLabel}
      className={panelClassName}
      data-testid="notification-center-panel"
      id={id}
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
    >
      {renderContent()}
    </div>
  );
};
