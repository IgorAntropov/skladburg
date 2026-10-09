import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  useCallback,
  useRef,
  useState,
} from 'react';

import type { AppSectionValue } from '@/shared/routing';

import {
  ResetDemoButton,
  ResetDemoConfirm,
  useIsDemoResetAvailable,
} from '@/features/reset-demo';
import { ThemeSwitcher } from '@/features/switch-theme';
import { useTenantSettings } from '@/shared/tenant';
import { Panel } from '@/shared/ui';

import { PhoneMenuLauncher } from './PhoneMenuLauncher';
import { SearchField } from './SearchField';
import { SectionNav } from './SectionNav';

const PANEL_CLASS_NAME = [
  'relative z-20 rounded-none border-x-0 border-t-0',
  'pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]',
].join(' ');

const ROW_CLASS_NAME = 'flex min-h-15 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:flex-nowrap lg:gap-x-4';

const BRAND_CLASS_NAME = 'max-w-40 shrink-0 truncate text-lg font-semibold tracking-tight sm:max-w-44 xl:max-w-56';

const DESKTOP_CLUSTER_CLASS_NAME = 'hidden items-center gap-3 xl:flex **:data-segment-label:sr-only';

export interface TopBarProps {
  currentSection: AppSectionValue | undefined;
  personaSwitcher: ReactNode | undefined;
  sections: readonly AppSectionValue[];
}

export const TopBar = ({ currentSection, personaSwitcher, sections }: TopBarProps): ReactElement => {
  const { brandName } = useTenantSettings();
  const isDemoResetAvailable = useIsDemoResetAvailable();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isResetConfirming, setIsResetConfirming] = useState(false);

  const isResetConfirmShown = isResetConfirming && isDemoResetAvailable;

  const handleResetRequest = useCallback((): void => {
    console.log('> TopBar -> handleResetRequest:', {});
    setIsResetConfirming(true);
  }, []);

  const handleResetConfirmClose = (): void => {
    console.log('> TopBar -> handleResetConfirmClose:', {});
    setIsResetConfirming(false);
    menuButtonRef.current?.focus();
  };

  return (
    <Panel as="header" className={PANEL_CLASS_NAME}>
      <div className={ROW_CLASS_NAME}>
        <p className={BRAND_CLASS_NAME} translate="no">
          {brandName}
        </p>
        <SectionNav currentSection={currentSection} sections={sections} />
        <SearchField />
        <div className="contents" data-testid="top-bar-clock-slot" />
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          <div className={DESKTOP_CLUSTER_CLASS_NAME}>
            {personaSwitcher}
            <ThemeSwitcher />
            <ResetDemoButton />
          </div>
          <div className="xl:hidden">
            <PhoneMenuLauncher
              buttonRef={menuButtonRef}
              currentSection={currentSection}
              onResetRequest={handleResetRequest}
              sections={sections}
            />
          </div>
        </div>
      </div>
      {isResetConfirmShown && (
        <div className="border-t border-line px-4 py-3 xl:hidden">
          <ResetDemoConfirm onClose={handleResetConfirmClose} />
        </div>
      )}
    </Panel>
  );
};
