import type {
  ReactElement,
  Ref,
} from 'react';

import { RotateCcw } from 'lucide-react';
import {
  useEffect,
  useRef,
} from 'react';

import type { AppSectionValue } from '@/shared/routing';

import {
  useIsDemoResetAvailable,
  useIsDemoResetPending,
} from '@/features/reset-demo';
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

export { ProfileResetConfirmLayer } from './ProfileResetConfirmLayer';

const MENU_ITEM_SELECTOR = '[role^="menuitem"]';

const MENU_ROOT_CLASS_NAME = [
  'flex max-h-[calc(var(--radix-dropdown-menu-content-available-height)-0.875rem)] flex-col',
  '[&_[role^=menuitem]:active:not([data-disabled])]:bg-on-panel/20!',
].join(' ');

const MENU_FIXED_PART_CLASS_NAME = 'shrink-0';

const MENU_SCROLL_PART_CLASS_NAME = [
  'min-h-0 flex-auto overflow-y-auto overscroll-contain scroll-shadow-y',
  '[&_[role=menuitemradio]]:py-1',
].join(' ');

export interface ProfileMenuProps {
  buttonRef: Ref<HTMLButtonElement> | undefined;
  currentSection: AppSectionValue | undefined;
  isFirstItemFocused: boolean;
  isOpen: boolean;
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
  onResetRequest,
  sections,
}: ProfileMenuItemsProps): ReactElement => {
  const { t } = useI18n();
  const demoControl = useDemoControl();
  const viewportClass = useViewportClass();
  const isDemoResetAvailable = useIsDemoResetAvailable();
  const rootRef = useRef<HTMLDivElement>(null);

  const isDemoActive = demoControl !== undefined;
  const isSectionsShown = viewportClass === 'phone' && sections.length > 0;
  const isScrollPartShown = isSectionsShown || isDemoActive;
  const isSectionsSeparatorShown = isSectionsShown && isDemoActive;

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
      </div>
      {isScrollPartShown && (
        <>
          <div className={MENU_SCROLL_PART_CLASS_NAME} data-testid="profile-menu-scroll">
            {isSectionsShown && <ProfileSections currentSection={currentSection} sections={sections} />}
            {isSectionsSeparatorShown && <DropdownMenuSeparator />}
            {isDemoActive && <PersonaMenuGroups focusKey={PROFILE_MENU_FOCUS_KEY} />}
          </div>
          <DropdownMenuSeparator />
        </>
      )}
      <div className={MENU_FIXED_PART_CLASS_NAME} data-testid="profile-menu-footer">
        <DropdownMenuLabel>{t('theme.label')}</DropdownMenuLabel>
        <ThemeMenuRadioGroup />
        {isDemoResetAvailable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleResetSelect}>
              <RotateCcw aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
              {t('demo.reset.menuItem')}
            </DropdownMenuItem>
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
      <DropdownMenuContent align="end" label={t('profile.menu.label')} width="profile">
        <ProfileMenuItems {...itemsProps} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
