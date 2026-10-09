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
import { WorldClock } from './WorldClock';

const PANEL_CLASS_NAME = [
  'relative z-20 rounded-none border-x-0 border-t-0',
  'pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]',
].join(' ');

const ROW_CLASS_NAME = 'flex min-h-15 flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2 sm:flex-nowrap sm:gap-x-3 lg:gap-x-4';

const PRODUCT_CLASS_NAME = 'flex shrink-0 items-center gap-2.5';

const PRODUCT_NAME_CLASS_NAME = 'text-lg font-bold tracking-tight max-[359px]:sr-only';

const TRAILING_GROUP_CLASS_NAME = 'flex shrink-0 items-center gap-2 sm:ml-auto sm:gap-3';

const HIDDEN_ON_PHONE_CLASS_NAME = 'max-sm:hidden';

export interface TopBarProps {
  currentSection: AppSectionValue | undefined;
  profileMenu: ReactNode;
  sections: readonly AppSectionValue[];
}

export const TopBar = ({ currentSection, profileMenu, sections }: TopBarProps): ReactElement => {
  const { t } = useI18n();
  const [isPhoneSearchOpen, setIsPhoneSearchOpen] = useState(false);

  return (
    <Panel as="header" className={PANEL_CLASS_NAME}>
      <div className={ROW_CLASS_NAME}>
        <div className={cn(PRODUCT_CLASS_NAME, isPhoneSearchOpen && HIDDEN_ON_PHONE_CLASS_NAME)}>
          <ProductMark />
          <p className={PRODUCT_NAME_CLASS_NAME} translate="no">
            {t('app.productName')}
          </p>
        </div>
        <SectionNav currentSection={currentSection} sections={sections} />
        <SearchField isPhoneFieldOpen={isPhoneSearchOpen} onPhoneFieldOpenChange={setIsPhoneSearchOpen} />
        <div className={cn(TRAILING_GROUP_CLASS_NAME, isPhoneSearchOpen && HIDDEN_ON_PHONE_CLASS_NAME)}>
          <WorldClock />
          {profileMenu}
        </div>
      </div>
    </Panel>
  );
};
