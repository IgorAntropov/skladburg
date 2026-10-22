import type {
  ReactElement,
  Ref,
} from 'react';

import {
  RotateCcw,
  UserRound,
} from 'lucide-react';
import {
  useEffect,
  useRef,
} from 'react';

import type { AppSectionValue } from '@/shared/routing';

import {
  InstallAppMenuItem,
  useIsInstallAppAvailable,
} from '@/features/install-app';
import {
  useIsDemoResetAvailable,
  useIsDemoResetPending,
} from '@/features/reset-demo';
import { GraphicsMenuRadioGroup } from '@/features/scene-settings';
import { PersonaMenuGroups } from '@/features/switch-persona';
import { ThemeMenuRadioGroup } from '@/features/switch-theme';
import { useDemoControl } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { useViewportClass } from '@/shared/lib/viewport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui';

import { PROFILE_MENU_FOCUS_KEY } from '../../lib/profileMenuFocusKey';
import { ProfileButton } from '../ProfileButton';
import { ProfileMenuHeader } from './ProfileMenuHeader';
import { ProfileSections } from './ProfileSections';

export { ProfileInstallInstructionsLayer } from './ProfileInstallInstructionsLayer';
export { ProfileMyProfileLayer } from './ProfileMyProfileLayer';
export { ProfileResetConfirmLayer } from './ProfileResetConfirmLayer';

const MENU_ITEM_SELECTOR = '[role^="menuitem"]';

const MENU_ROOT_CLASS_NAME = [
  'flex max-h-[calc(var(--radix-dropdown-menu-content-available-height)-0.875rem)] flex-col overflow-y-auto overscroll-contain',
  '[&_[role^=menuitem]:active:not([data-disabled])]:bg-on-panel/20!',
].join(' ');

const MENU_FIXED_PART_CLASS_NAME = 'shrink-0';

const MENU_SCROLL_PART_CLASS_NAME = [
  'min-h-44 flex-auto overflow-y-auto overscroll-contain scroll-shadow-y',
  '[&_[role=menuitemradio]]:py-1',
].join(' ');

export interface ProfileMenuProps {
  buttonRef: Ref<HTMLButtonElement> | undefined;
  currentSection: AppSectionValue | undefined;
  isFirstItemFocused: boolean;
  isOpen: boolean;
  onInstallInstructionsRequest: () => void;
  onMyProfileRequest: () => void;
  onOpenChange: (isOpen: boolean) => void;
  onResetRequest: () => void;
  sections: readonly AppSectionValue[];
}

type ProfileMenuItemsProps = Omit<ProfileMenuProps, 'buttonRef' | 'isOpen' | 'onOpenChange'>;

const focusFirstMenuItem = (root: HTMLElement): void => {
  for (const item of root.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)) {
    item.focus();

    if (document.activeElement === item) {
      return;
    }
  }
};

const ProfileMenuItems = ({
  currentSection,
  isFirstItemFocused,
  onInstallInstructionsRequest,
  onMyProfileRequest,
  onResetRequest,
  sections,
}: ProfileMenuItemsProps): ReactElement => {
  const { t } = useI18n();
  const demoControl = useDemoControl();
  const viewportClass = useViewportClass();
  const isDemoResetAvailable = useIsDemoResetAvailable();
  const isInstallAppAvailable = useIsInstallAppAvailable();
  const rootRef = useRef<HTMLDivElement>(null);

  const isDemoActive = demoControl !== undefined;
  const isSectionsShown = viewportClass === 'phone' && sections.length > 0;
  const isScrollPartShown = isSectionsShown || isDemoActive;
  const isSectionsSeparatorShown = isSectionsShown && isDemoActive;
  const isServicePartShown = isInstallAppAvailable || isDemoResetAvailable;

  const handleMyProfileSelect = (): void => {
    console.log('> ProfileMenu -> handleMyProfileSelect:', {});
    onMyProfileRequest();
  };

  const handleResetSelect = (): void => {
    console.log('> ProfileMenu -> handleResetSelect:', {});
    onResetRequest();
  };

  useEffect(() => {
    if (isFirstItemFocused && rootRef.current !== null) {
      focusFirstMenuItem(rootRef.current);
    }
  }, [isFirstItemFocused]);

  return (
    <div className={MENU_ROOT_CLASS_NAME} ref={rootRef}>
      <div className={MENU_FIXED_PART_CLASS_NAME}>
        <ProfileMenuHeader />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleMyProfileSelect} testId="profile-menu-my-profile">
          <UserRound aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
          {t('profile.myProfile.menuItem')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      </div>
      {isScrollPartShown && (
        <>
          <div className={MENU_SCROLL_PART_CLASS_NAME}>
            {isSectionsShown && <ProfileSections currentSection={currentSection} sections={sections} />}
            {isSectionsSeparatorShown && <DropdownMenuSeparator />}
            {isDemoActive && <PersonaMenuGroups focusKey={PROFILE_MENU_FOCUS_KEY} />}
          </div>
          <DropdownMenuSeparator />
        </>
      )}
      <div className={MENU_FIXED_PART_CLASS_NAME}>
        <DropdownMenuLabel>{t('theme.label')}</DropdownMenuLabel>
        <ThemeMenuRadioGroup />
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('graphics.label')}</DropdownMenuLabel>
        <GraphicsMenuRadioGroup />
        {isServicePartShown && (
          <>
            <DropdownMenuSeparator />
            <InstallAppMenuItem onInstructionsRequest={onInstallInstructionsRequest} />
            {isDemoResetAvailable && (
              <DropdownMenuItem onSelect={handleResetSelect} testId="profile-menu-reset">
                <RotateCcw aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
                {t('demo.reset.menuItem')}
              </DropdownMenuItem>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const ProfileMenu = ({
  buttonRef,
  isOpen,
  onOpenChange,
  ...itemsProps
}: ProfileMenuProps): ReactElement => {
  const { t } = useI18n();
  const isResetPending = useIsDemoResetPending();

  const handleOpenChange = (nextIsOpen: boolean): void => {
    console.log('> ProfileMenu -> handleOpenChange:', { isResetPending, nextIsOpen });
    if (nextIsOpen && isResetPending) {
      return;
    }
    onOpenChange(nextIsOpen);
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange} open={isOpen}>
      <DropdownMenuTrigger>
        <ProfileButton busyReason={isResetPending ? 'resetting' : undefined} buttonRef={buttonRef} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" label={t('profile.menu.label')} testId="profile-menu" width="profile">
        <ProfileMenuItems {...itemsProps} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
