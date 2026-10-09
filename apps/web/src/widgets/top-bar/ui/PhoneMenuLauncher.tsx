import type {
  ComponentType,
  ReactElement,
  Ref,
} from 'react';

import {
  useEffect,
  useState,
} from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { createCachedModuleLoader } from '@/shared/lib/module-loader';

import type { PhoneMenuProps } from './PhoneMenu';

import { loadPhoneMenu } from './loadPhoneMenu';
import { MenuToggleButton } from './MenuToggleButton';

export interface PhoneMenuLauncherProps {
  buttonRef: Ref<HTMLButtonElement> | undefined;
  currentSection: AppSectionValue | undefined;
  onResetRequest: () => void;
  sections: readonly AppSectionValue[];
}

type PhoneMenuComponent = ComponentType<PhoneMenuProps>;

type PhoneMenuLaunchStateValue
  = | { kind: 'error' }
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; PhoneMenu: PhoneMenuComponent };

const IDLE_STATE: PhoneMenuLaunchStateValue = { kind: 'idle' };

const loadCachedPhoneMenu = createCachedModuleLoader(loadPhoneMenu);

const LOAD_ERROR_CLASS_NAME = [
  'absolute top-full right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)]',
  'rounded-control border border-line bg-panel-solid p-3 text-sm text-on-panel shadow-panel',
].join(' ');

export const PhoneMenuLauncher = ({
  buttonRef,
  currentSection,
  onResetRequest,
  sections,
}: PhoneMenuLauncherProps): ReactElement => {
  const { t } = useI18n();
  const [launchState, setLaunchState] = useState<PhoneMenuLaunchStateValue>(IDLE_STATE);
  const [isOpen, setIsOpen] = useState(false);
  const [isOpenedByLaunch, setIsOpenedByLaunch] = useState(false);
  const [isResetRequested, setIsResetRequested] = useState(false);

  const isLoading = launchState.kind === 'loading';

  const handleWarmUp = (): void => {
    if (launchState.kind === 'ready') {
      return;
    }
    void loadCachedPhoneMenu().then(undefined, (error: unknown) => {
      console.log('> PhoneMenuLauncher -> handleWarmUp:', { error });
    });
  };

  const handleToggleClick = (): void => {
    console.log('> PhoneMenuLauncher -> handleToggleClick:', { kind: launchState.kind });
    const settlement = { isSettled: false };

    void loadCachedPhoneMenu().then(
      (loadedModule) => {
        settlement.isSettled = true;
        setLaunchState({ kind: 'ready', PhoneMenu: loadedModule.PhoneMenu });
        setIsOpenedByLaunch(true);
        setIsOpen(true);
      },
      (error: unknown) => {
        settlement.isSettled = true;
        console.log('> PhoneMenuLauncher -> handleToggleClick:', { error });
        setLaunchState({ kind: 'error' });
      },
    );

    if (!settlement.isSettled) {
      setLaunchState({ kind: 'loading' });
    }
  };

  const handleOpenChange = (nextIsOpen: boolean): void => {
    console.log('> PhoneMenuLauncher -> handleOpenChange:', { nextIsOpen });
    setIsOpen(nextIsOpen);
    if (!nextIsOpen) {
      setIsOpenedByLaunch(false);
    }
  };

  const handleResetRequest = (): void => {
    console.log('> PhoneMenuLauncher -> handleResetRequest:', {});
    setIsResetRequested(true);
  };

  useEffect(() => {
    if (!isResetRequested || isOpen) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setIsResetRequested(false);
      onResetRequest();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isOpen, isResetRequested, onResetRequest]);

  if (launchState.kind === 'ready') {
    const { PhoneMenu } = launchState;

    return (
      <PhoneMenu
        buttonRef={buttonRef}
        currentSection={currentSection}
        isFirstItemFocused={isOpenedByLaunch}
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        onResetRequest={handleResetRequest}
        sections={sections}
      />
    );
  }

  return (
    <div className="relative">
      <MenuToggleButton
        aria-expanded={false}
        buttonRef={buttonRef}
        onClick={handleToggleClick}
        onFocus={handleWarmUp}
        onPointerEnter={handleWarmUp}
        pending={isLoading}
      />
      {launchState.kind === 'error' && (
        <p className={LOAD_ERROR_CLASS_NAME} role="alert">{t('routing.chunkError.message')}</p>
      )}
    </div>
  );
};
