import type {
  ReactElement,
  ReactNode,
} from 'react';

import { useState } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Panel } from '@/shared/ui';

import { ProductMark } from './ProductMark';
import { SearchField } from './SearchField';
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

  return (
    <Panel as="header" className={TOP_BAR_PANEL_CLASS_NAME}>
      <div className={TOP_BAR_ROW_CLASS_NAME}>
        <div className={cn(TOP_BAR_PRODUCT_CLASS_NAME, isPhoneSearchOpen && HIDDEN_ON_PHONE_CLASS_NAME)}>
          <ProductMark />
          <p className={TOP_BAR_PRODUCT_NAME_CLASS_NAME} translate="no">
            {t('app.productName')}
          </p>
        </div>
        <SectionNav currentSection={currentSection} sections={sections} />
        <div className={cn(PANELS_TOGGLE_SLOT_CLASS_NAME, isPhoneSearchOpen && HIDDEN_ON_PHONE_CLASS_NAME)}>{panelsToggle}</div>
        <SearchField isPhoneFieldOpen={isPhoneSearchOpen} onPhoneFieldOpenChange={setIsPhoneSearchOpen} />
        <div className={cn(TRAILING_GROUP_CLASS_NAME, isPhoneSearchOpen && HIDDEN_ON_PHONE_CLASS_NAME)}>
          <WorldClock />
          {assistant}
          {profileMenu}
        </div>
      </div>
    </Panel>
  );
};
