import type {
  ComponentType,
  ReactElement,
} from 'react';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { createCachedModuleLoader } from '@/shared/lib/module-loader';

import type { ProfileMenuProps } from './menu/ProfileMenu';
import type { ProfileResetConfirmLayerProps } from './menu/ProfileResetConfirmLayer';

import { loadProfileMenu } from './loadProfileMenu';
import { ProfileButton } from './ProfileButton';

export interface ProfileMenuLauncherProps {
  currentSection: AppSectionValue | undefined;
  sections: readonly AppSectionValue[];
}

type ProfileMenuComponent = ComponentType<ProfileMenuProps>;
type ProfileMenuLaunchStateValue
  = | { kind: 'error' }
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; ProfileMenu: ProfileMenuComponent; ProfileResetConfirmLayer: ProfileResetConfirmLayerComponent };

type ProfileResetConfirmLayerComponent = ComponentType<ProfileResetConfirmLayerProps>;

const IDLE_STATE: ProfileMenuLaunchStateValue = { kind: 'idle' };

const loadCachedProfileMenu = createCachedModuleLoader(loadProfileMenu);

const LAUNCHER_CLASS_NAME = 'relative flex';

const LOAD_ERROR_CLASS_NAME = [
  'absolute top-full right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)]',
  'rounded-control border border-line bg-panel-solid p-3 text-sm text-on-panel shadow-panel',
].join(' ');

export const ProfileMenuLauncher = ({ currentSection, sections }: ProfileMenuLauncherProps): ReactElement => {
  const { t } = useI18n();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [launchState, setLaunchState] = useState<ProfileMenuLaunchStateValue>(IDLE_STATE);
  const [isOpen, setIsOpen] = useState(false);
  const [isOpenedByLaunch, setIsOpenedByLaunch] = useState(false);
  const [isResetRequested, setIsResetRequested] = useState(false);
  const [isResetConfirmShown, setIsResetConfirmShown] = useState(false);

  const isLoading = launchState.kind === 'loading';
  const isLoadFailed = launchState.kind === 'error';

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
        setLaunchState({ kind: 'error' });
      },
    );

    if (!settlement.isSettled) {
      setLaunchState({ kind: 'loading' });
    }
  };

  const handleOpenChange = (nextIsOpen: boolean): void => {
    console.log('> ProfileMenuLauncher -> handleOpenChange:', { nextIsOpen });
    setIsOpen(nextIsOpen);
    if (nextIsOpen) {
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
        <p className={LOAD_ERROR_CLASS_NAME} role="alert">{t('routing.chunkError.message')}</p>
      )}
    </div>
  );
};
