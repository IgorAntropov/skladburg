import type {
  ComponentType,
  ReactElement,
  ReactNode,
} from 'react';

import { TriangleAlert } from 'lucide-react';
import {
  useCallback,
  useId,
  useRef,
  useState,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { createCachedModuleLoader } from '@/shared/lib/module-loader';
import {
  Button,
  useFocusHandoff,
} from '@/shared/ui';

import type { NotificationCloseReasonValue } from '../lib/notificationCloseReason';
import type { NotificationCenterPanelProps } from './panel/NotificationCenterPanel';

import { NOTIFICATION_CENTER_FOCUS_KEY } from '../lib/notificationFocusKey';
import { UnreadCountSinkContext } from '../lib/unreadCountSink';
import { loadNotificationCenterPanel } from './loadNotificationCenterPanel';
import { NotificationButton } from './NotificationButton';

export interface NotificationCenterLauncherProps {
  renderReplica?: ((slot: NotificationReplicaSlotValue) => ReactNode) | undefined;
  unreadCountReporter?: ReactNode | undefined;
}

export interface NotificationReplicaSlotValue {
  isPanelOpen: boolean;
  openCenter: () => void;
}

type LaunchStateValue
  = | { kind: 'error' }
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; Panel: ComponentType<NotificationCenterPanelProps> };

const IDLE_STATE: LaunchStateValue = { kind: 'idle' };

const loadCachedPanel = createCachedModuleLoader(loadNotificationCenterPanel);

const LOAD_ERROR_CLASS_NAME = [
  'absolute top-full right-0 z-20 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col items-start gap-3',
  'rounded-panel border border-line bg-panel-solid p-4 text-on-panel shadow-raised max-sm:right-3',
].join(' ');

const LOAD_ERROR_BADGE_CLASS_NAME = 'flex size-6 shrink-0 items-center justify-center rounded-full bg-status-alarm text-on-status-alarm';

export const NotificationCenterLauncher = ({ renderReplica, unreadCountReporter }: NotificationCenterLauncherProps): ReactElement => {
  const { locale, t } = useI18n();
  const { cancelFocus, ref: handoffRef, requestFocus } = useFocusHandoff<HTMLButtonElement>(NOTIFICATION_CENTER_FOCUS_KEY);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const [launchState, setLaunchState] = useState<LaunchStateValue>(IDLE_STATE);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isLoading = launchState.kind === 'loading';
  const isLoadFailed = launchState.kind === 'error';

  const handleButtonRef = useCallback((element: HTMLButtonElement | null): void => {
    buttonRef.current = element;
    handoffRef(element);
  }, [handoffRef]);

  const showPanel = (Panel: ComponentType<NotificationCenterPanelProps>): void => {
    setLaunchState({ kind: 'ready', Panel });
    cancelFocus();
    setIsOpen(true);
  };

  const handleWarmUp = (): void => {
    if (launchState.kind === 'ready') {
      return;
    }
    void loadCachedPanel().then(
      (loadedModule) => {
        loadedModule.requestNotificationTexts(locale);
      },
      (error: unknown) => {
        console.log('> NotificationCenterLauncher -> handleWarmUp:', { error });
      },
    );
  };

  const handleButtonClick = (): void => {
    console.log('> NotificationCenterLauncher -> handleButtonClick:', { isOpen, kind: launchState.kind });

    if (isOpen) {
      setIsOpen(false);

      return;
    }

    const loadedPanel = loadCachedPanel.peekLoadedModule();

    if (loadedPanel?.isNotificationTextsReady(locale) === true) {
      showPanel(loadedPanel.NotificationCenterPanel);

      return;
    }

    setLaunchState({ kind: 'loading' });
    void loadCachedPanel().then(async (loadedModule) => {
      await loadedModule.loadNotificationTexts(locale);

      return loadedModule;
    }).then(
      (loadedModule) => {
        showPanel(loadedModule.NotificationCenterPanel);
      },
      (error: unknown) => {
        console.log('> NotificationCenterLauncher -> handleButtonClick:', { error });
        setLaunchState({ kind: 'error' });
      },
    );
  };

  const handlePanelClose = useCallback((reason: NotificationCloseReasonValue): void => {
    console.log('> NotificationCenterLauncher -> handlePanelClose:', { reason });
    setIsOpen(false);

    if (reason !== 'outside') {
      requestFocus();
      buttonRef.current?.focus();
    }
  }, [requestFocus]);

  const isPanelShown = launchState.kind === 'ready' && isOpen;

  const openCenter = (): void => {
    console.log('> NotificationCenterLauncher -> openCenter:', { isPanelShown });

    if (isPanelShown) {
      return;
    }

    handleButtonClick();
  };

  return (
    <div className="flex sm:relative" data-testid="notification-center" ref={rootRef}>
      <NotificationButton
        aria-controls={isPanelShown ? panelId : undefined}
        aria-expanded={isPanelShown}
        onClick={handleButtonClick}
        onFocus={handleWarmUp}
        onPointerEnter={handleWarmUp}
        pending={isLoading}
        ref={handleButtonRef}
        unreadCount={unreadCount}
      />
      <UnreadCountSinkContext value={setUnreadCount}>{unreadCountReporter}</UnreadCountSinkContext>
      {isPanelShown && <launchState.Panel anchorRef={rootRef} id={panelId} onClose={handlePanelClose} />}
      {renderReplica?.({ isPanelOpen: isPanelShown, openCenter })}
      {isLoadFailed && (
        <div className={LOAD_ERROR_CLASS_NAME}>
          <div className="flex items-start gap-2">
            <span aria-hidden className={LOAD_ERROR_BADGE_CLASS_NAME}>
              <TriangleAlert className="size-4" />
            </span>
            <p className="text-base leading-6" role="alert">{t('hud.notifications.loadError')}</p>
          </div>
          <Button onClick={handleButtonClick} variant="secondary">{t('common.retry')}</Button>
        </div>
      )}
    </div>
  );
};
