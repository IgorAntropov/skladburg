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

export { ProfileResetConfirm } from './ProfileResetConfirm';

const MENU_ITEM_SELECTOR = '[role^="menuitem"]';

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
    <div ref={rootRef}>
      <ProfileMenuHeader />
      <DropdownMenuSeparator />
      {isSectionsShown && (
        <>
          <ProfileSections currentSection={currentSection} sections={sections} />
          <DropdownMenuSeparator />
        </>
      )}
      {isDemoActive && (
        <>
          <PersonaMenuGroups focusKey={PROFILE_MENU_FOCUS_KEY} />
          <DropdownMenuSeparator />
        </>
      )}
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
        <ProfileButton buttonRef={buttonRef} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" label={t('profile.menu.label')} width="profile">
        <ProfileMenuItems {...itemsProps} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
