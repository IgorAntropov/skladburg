import type {
  ReactElement,
  Ref,
} from 'react';

import {
  useEffect,
  useRef,
} from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useIsDemoResetAvailable } from '@/features/reset-demo';
import { PersonaMenuRadioGroup } from '@/features/switch-persona';
import { ThemeMenuRadioGroup } from '@/features/switch-theme';
import { useDemoControl } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  SECTION_TITLE_KEYS,
  useNavigate,
} from '@/shared/routing';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui';

import { MENU_FOCUS_KEY } from '../lib/menuFocusKey';
import { MenuToggleButton } from './MenuToggleButton';

const MENU_ITEM_SELECTOR = '[role^="menuitem"]';

export interface PhoneMenuProps {
  buttonRef: Ref<HTMLButtonElement> | undefined;
  currentSection: AppSectionValue | undefined;
  isFirstItemFocused: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onResetRequest: () => void;
  sections: readonly AppSectionValue[];
}

type PhoneMenuItemsProps = Omit<PhoneMenuProps, 'buttonRef' | 'isOpen' | 'onOpenChange'>;

const focusFirstMenuItem = (root: HTMLElement): void => {
  for (const item of root.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)) {
    item.focus();

    if (document.activeElement === item) {
      return;
    }
  }
};

const PhoneMenuItems = ({
  currentSection,
  isFirstItemFocused,
  onResetRequest,
  sections,
}: PhoneMenuItemsProps): ReactElement => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const demoControl = useDemoControl();
  const isDemoResetAvailable = useIsDemoResetAvailable();
  const rootRef = useRef<HTMLDivElement>(null);

  const isDemoActive = demoControl !== undefined;
  const hasSections = sections.length > 0;

  const handleSectionChange = (section: AppSectionValue): void => {
    console.log('> PhoneMenu -> handleSectionChange:', { section });
    if (section === currentSection) {
      return;
    }
    navigate({ kind: 'section', section });
  };

  const handleResetSelect = (): void => {
    console.log('> PhoneMenu -> handleResetSelect:', {});
    onResetRequest();
  };

  useEffect(() => {
    if (isFirstItemFocused && rootRef.current !== null) {
      focusFirstMenuItem(rootRef.current);
    }
  }, [isFirstItemFocused]);

  return (
    <div ref={rootRef}>
      {hasSections && (
        <div className="sm:hidden">
          <DropdownMenuLabel>{t('app.nav.label')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup label={t('app.nav.label')} onValueChange={handleSectionChange} value={currentSection}>
            {sections.map(section => (
              <DropdownMenuRadioItem key={section} value={section}>
                {t(SECTION_TITLE_KEYS[section])}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
        </div>
      )}
      {isDemoActive && (
        <>
          <PersonaMenuRadioGroup focusKey={MENU_FOCUS_KEY} />
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuLabel>{t('theme.label')}</DropdownMenuLabel>
      <ThemeMenuRadioGroup />
      {isDemoResetAvailable && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleResetSelect}>{t('menu.resetDemo')}</DropdownMenuItem>
        </>
      )}
    </div>
  );
};

export const PhoneMenu = ({
  buttonRef,
  isOpen,
  onOpenChange,
  ...itemsProps
}: PhoneMenuProps): ReactElement => {
  const { t } = useI18n();

  return (
    <DropdownMenu onOpenChange={onOpenChange} open={isOpen}>
      <DropdownMenuTrigger>
        <MenuToggleButton buttonRef={buttonRef} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" label={t('menu.label')}>
        <PhoneMenuItems {...itemsProps} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
