import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  Panel,
  Skeleton,
} from '@/shared/ui';

import { ProductMark } from './ProductMark';
import {
  TOP_BAR_PANEL_CLASS_NAME,
  TOP_BAR_PRODUCT_CLASS_NAME,
  TOP_BAR_PRODUCT_NAME_CLASS_NAME,
  TOP_BAR_ROW_CLASS_NAME,
} from './topBarStyles';

const PANEL_CLASS_NAME = `${TOP_BAR_PANEL_CLASS_NAME} pointer-events-none select-none`;

const NAV_CLASS_NAME = 'hidden gap-0.5 sm:flex';

const NAV_ITEM_CLASS_NAME = 'flex h-11 items-center px-2 lg:px-3';

const PHONE_SEARCH_CLASS_NAME = 'flex size-11 shrink-0 items-center justify-center sm:hidden';

const SEARCH_CLASS_NAME = 'h-11 min-w-28 max-w-72 flex-1 max-sm:hidden';

const TRAILING_GROUP_CLASS_NAME = 'flex shrink-0 items-center gap-2 sm:ml-auto sm:gap-3';

const CLOCK_CLASS_NAME = 'h-4 w-[2.8em] text-sm sm:h-5 sm:text-base';

const AVATAR_SLOT_CLASS_NAME = 'flex size-11 shrink-0 items-center justify-center';

const NAV_ITEMS = [
  { id: 'first', widthClassName: 'w-10' },
  { id: 'second', widthClassName: 'w-14' },
  { id: 'third', widthClassName: 'w-12' },
] as const;

export const TopBarSkeleton = (): ReactElement => {
  const { t } = useI18n();

  return (
    <Panel aria-hidden className={PANEL_CLASS_NAME} inert>
      <div className={TOP_BAR_ROW_CLASS_NAME}>
        <div className={TOP_BAR_PRODUCT_CLASS_NAME}>
          <ProductMark />
          <p className={TOP_BAR_PRODUCT_NAME_CLASS_NAME} translate="no">
            {t('app.productName')}
          </p>
        </div>
        <div className={NAV_CLASS_NAME}>
          {NAV_ITEMS.map(({ id, widthClassName }) => (
            <div className={NAV_ITEM_CLASS_NAME} key={id}>
              <Skeleton className={`h-5 ${widthClassName}`} />
            </div>
          ))}
        </div>
        <div className={PHONE_SEARCH_CLASS_NAME}>
          <Skeleton className="size-5" />
        </div>
        <Skeleton className={SEARCH_CLASS_NAME} />
        <div className={TRAILING_GROUP_CLASS_NAME}>
          <Skeleton className={CLOCK_CLASS_NAME} />
          <div className={AVATAR_SLOT_CLASS_NAME}>
            <Skeleton className="size-9" shape="circle" />
          </div>
          <div className={AVATAR_SLOT_CLASS_NAME}>
            <Skeleton className="size-9" shape="circle" />
          </div>
        </div>
      </div>
    </Panel>
  );
};
