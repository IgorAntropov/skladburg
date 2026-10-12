import type {
  ComponentType,
  ReactElement,
} from 'react';

import { TriangleAlert } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { ChunkRecoveryValue } from '@/shared/lib/module-loader';
import type { AppSectionValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  getChunkRecovery,
} from '@/shared/lib/module-loader';
import { useReloadPage } from '@/shared/routing';
import {
  Button,
  useFocusHandoff,
} from '@/shared/ui';

import type { ProfileMenuProps } from './menu/ProfileMenu';
import type { ProfileResetConfirmLayerProps } from './menu/ProfileResetConfirmLayer';

import { PROFILE_MENU_FOCUS_KEY } from '../lib/profileMenuFocusKey';
import { loadProfileMenu } from './loadProfileMenu';
import { ProfileButton } from './ProfileButton';

export interface ProfileMenuLauncherProps {
  currentSection: AppSectionValue | undefined;
  sections: readonly AppSectionValue[];
}

type ProfileMenuComponent = ComponentType<ProfileMenuProps>;
type ProfileMenuLaunchStateValue
  = | { kind: 'error'; recovery: ChunkRecoveryValue }
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; ProfileMenu: ProfileMenuComponent; ProfileResetConfirmLayer: ProfileResetConfirmLayerComponent };

type ProfileResetConfirmLayerComponent = ComponentType<ProfileResetConfirmLayerProps>;

const IDLE_STATE: ProfileMenuLaunchStateValue = { kind: 'idle' };

const loadCachedProfileMenu = createCachedModuleLoader(loadProfileMenu);

const LAUNCHER_CLASS_NAME = 'relative flex';

const LOAD_ERROR_CLASS_NAME = [
  'absolute top-full right-0 z-20 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col items-start gap-3',
  'rounded-panel border border-line bg-panel-solid p-4 text-on-panel shadow-raised',
].join(' ');

const LOAD_ERROR_BADGE_CLASS_NAME = 'flex size-6 shrink-0 items-center justify-center rounded-full bg-status-alarm text-on-status-alarm';

export const ProfileMenuLauncher = ({ currentSection, sections }: ProfileMenuLauncherProps): ReactElement => {
  const { t } = useI18n();
  const reloadPage = useReloadPage();
  const { cancelFocus, requestFocus } = useFocusHandoff<HTMLButtonElement>(PROFILE_MENU_FOCUS_KEY);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [launchState, setLaunchState] = useState<ProfileMenuLaunchStateValue>(IDLE_STATE);
  const [isOpen, setIsOpen] = useState(false);
  const [isOpenedByLaunch, setIsOpenedByLaunch] = useState(false);
  const [isResetRequested, setIsResetRequested] = useState(false);
  const [isResetConfirmShown, setIsResetConfirmShown] = useState(false);

  const isLoading = launchState.kind === 'loading';
  const isLoadFailed = launchState.kind === 'error';
  const isReloadNeeded = launchState.kind === 'error' && launchState.recovery === 'reload';

  const handleWarmUp = (): void => {
    if (launchState.kind === 'ready') {
      return;
    }
    void loadCachedProfileMenu().then(undefined, (error: unknown) => {
      console.log('> ProfileMenuLauncher -> handleWarmUp:', { error });
    });
  };

  const handleButtonClick = (): void => {
    console.log('> ProfileMenuLauncher -> handleButtonClick:', { kind: launchState.kind });
    const settlement = { isSettled: false };

    void loadCachedProfileMenu().then(
      (loadedModule) => {
        settlement.isSettled = true;
        setLaunchState({
          kind: 'ready',
          ProfileMenu: loadedModule.ProfileMenu,
          ProfileResetConfirmLayer: loadedModule.ProfileResetConfirmLayer,
        });
        setIsOpenedByLaunch(true);
        setIsOpen(true);
      },
      (error: unknown) => {
        settlement.isSettled = true;
        console.log('> ProfileMenuLauncher -> handleButtonClick:', { error });
        setLaunchState({ kind: 'error', recovery: getChunkRecovery(error) });
      },
    );

    if (!settlement.isSettled) {
      setLaunchState({ kind: 'loading' });
    }
  };

  const handleReloadClick = (): void => {
    console.log('> ProfileMenuLauncher -> handleReloadClick:', {});
    reloadPage();
  };

  const handleOpenChange = (nextIsOpen: boolean): void => {
    console.log('> ProfileMenuLauncher -> handleOpenChange:', { nextIsOpen });
    setIsOpen(nextIsOpen);
    if (nextIsOpen) {
      cancelFocus();
      setIsResetConfirmShown(false);
    }
    else {
      setIsOpenedByLaunch(false);
    }
  };

  const handleResetRequest = (): void => {
    console.log('> ProfileMenuLauncher -> handleResetRequest:', {});
    setIsResetRequested(true);
  };

  const handleResetConfirmClose = (): void => {
    console.log('> ProfileMenuLauncher -> handleResetConfirmClose:', {});
    setIsResetConfirmShown(false);
    requestFocus();
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!isResetRequested || isOpen) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setIsResetRequested(false);
      setIsResetConfirmShown(true);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isOpen, isResetRequested]);

  if (launchState.kind === 'ready') {
    const { ProfileMenu, ProfileResetConfirmLayer } = launchState;

    return (
      <div className={LAUNCHER_CLASS_NAME}>
        <ProfileMenu
          buttonRef={buttonRef}
          currentSection={currentSection}
          isFirstItemFocused={isOpenedByLaunch}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          onResetRequest={handleResetRequest}
          sections={sections}
        />
        <ProfileResetConfirmLayer isShown={isResetConfirmShown} onClose={handleResetConfirmClose} />
      </div>
    );
  }

  return (
    <div className={LAUNCHER_CLASS_NAME}>
      <ProfileButton
        aria-expanded={false}
        busyReason={isLoading ? 'loadingMenu' : undefined}
        buttonRef={buttonRef}
        onClick={handleButtonClick}
        onFocus={handleWarmUp}
        onPointerEnter={handleWarmUp}
      />
      {isLoadFailed && (
        <div className={LOAD_ERROR_CLASS_NAME}>
          <div className="flex items-start gap-2">
            <span aria-hidden className={LOAD_ERROR_BADGE_CLASS_NAME}>
              <TriangleAlert className="size-4" />
            </span>
            <p className="text-base leading-6" role="alert">
              {isReloadNeeded ? t('profile.menu.loadError.repeated') : t('profile.menu.loadError.message')}
            </p>
          </div>
          {isReloadNeeded
            ? <Button onClick={handleReloadClick} variant="secondary">{t('routing.chunkError.reload')}</Button>
            : <Button onClick={handleButtonClick} variant="secondary">{t('common.retry')}</Button>}
        </div>
      )}
    </div>
  );
};
