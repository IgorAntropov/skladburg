import type {
  ReactElement,
  ReactNode,
} from 'react';

import { useState } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { GlobalSearchField } from '@/features/global-search';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Panel } from '@/shared/ui';

import { ProductMark } from './ProductMark';
import { SectionNav } from './SectionNav';
import {
  TOP_BAR_PANEL_CLASS_NAME,
  TOP_BAR_PRODUCT_CLASS_NAME,
  TOP_BAR_PRODUCT_NAME_CLASS_NAME,
  TOP_BAR_ROW_CLASS_NAME,
} from './topBarStyles';
import { WorldClock } from './WorldClock';

const TRAILING_GROUP_CLASS_NAME = 'flex shrink-0 items-center gap-2 sm:ml-auto sm:gap-3';

const PANELS_TOGGLE_SLOT_CLASS_NAME = 'flex shrink-0 empty:hidden sm:hidden';

const HIDDEN_ON_PHONE_CLASS_NAME = 'max-sm:hidden';

const STANDARD_SECTION_COUNT = 4;

export interface TopBarProps {
  assistant?: ReactNode | undefined;
  currentSection: AppSectionValue | undefined;
  panelsToggle?: ReactNode | undefined;
  profileMenu: ReactNode;
  sections: readonly AppSectionValue[];
}

export const TopBar = ({
  assistant,
  currentSection,
  panelsToggle,
  profileMenu,
  sections,
}: TopBarProps): ReactElement => {
  const { t } = useI18n();
  const [isPhoneSearchOpen, setIsPhoneSearchOpen] = useState(false);

  const isNavigationCompact = sections.length > STANDARD_SECTION_COUNT;
  const trailingGroupClassName = cn(
    TRAILING_GROUP_CLASS_NAME,
    isPhoneSearchOpen && HIDDEN_ON_PHONE_CLASS_NAME,
    isNavigationCompact && 'sm:max-md:gap-2',
  );

  return (
    <Panel as="header" className={TOP_BAR_PANEL_CLASS_NAME}>
      <div className={cn(TOP_BAR_ROW_CLASS_NAME, isNavigationCompact && 'sm:max-md:gap-x-2 sm:max-md:px-3')}>
        <div className={cn(TOP_BAR_PRODUCT_CLASS_NAME, isPhoneSearchOpen && HIDDEN_ON_PHONE_CLASS_NAME)}>
          <ProductMark />
          <p className={cn(TOP_BAR_PRODUCT_NAME_CLASS_NAME, isNavigationCompact && 'sm:max-md:sr-only')} translate="no">
            {t('app.productName')}
          </p>
        </div>
        <SectionNav currentSection={currentSection} isCompact={isNavigationCompact} sections={sections} />
        <div className={cn(PANELS_TOGGLE_SLOT_CLASS_NAME, isPhoneSearchOpen && HIDDEN_ON_PHONE_CLASS_NAME)}>{panelsToggle}</div>
        <GlobalSearchField isPhoneFieldOpen={isPhoneSearchOpen} onPhoneFieldOpenChange={setIsPhoneSearchOpen} />
        <div className={trailingGroupClassName}>
          <WorldClock />
          {assistant}
          {profileMenu}
        </div>
      </div>
    </Panel>
  );
};
