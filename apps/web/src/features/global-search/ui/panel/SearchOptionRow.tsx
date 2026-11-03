import type { ReactElement } from 'react';

import type { AppAddressValue } from '@/shared/routing';

import type { GlobalSearchTranslate } from '../../i18n/globalSearchSection';
import type { SearchOptionValue } from '../../model/searchResultTypes';

import { HighlightedText } from './HighlightedText';
import { SearchOptionDetail } from './SearchOptionDetail';
import {
  SEARCH_GROUP_ICONS,
  SEARCH_OPTION_KIND_KEYS,
} from './searchPanelConfig';

const ROW_CLASS_NAME = [
  'group flex min-h-12 cursor-pointer touch-manipulation items-center gap-3 rounded-control px-3 py-2 select-none',
  'aria-selected:bg-hover aria-selected:ring-2 aria-selected:ring-indicator aria-selected:ring-inset active:bg-line',
  'aria-selected:active:bg-line',
].join(' ');

const ICON_CLASS_NAME = 'size-5 shrink-0 text-on-panel-muted group-aria-selected:text-on-panel';

const TITLE_CLASS_NAME = 'line-clamp-2 text-base leading-6 font-medium wrap-anywhere text-on-panel';

interface SearchOptionRowProps {
  domId: string;
  isActive: boolean;
  onActivate: (domId: string) => void;
  onChoose: (address: AppAddressValue) => void;
  option: SearchOptionValue;
  t: GlobalSearchTranslate;
}

export const SearchOptionRow = ({
  domId,
  isActive,
  onActivate,
  onChoose,
  option,
  t,
}: SearchOptionRowProps): ReactElement => {
  const Icon = SEARCH_GROUP_ICONS[option.groupId];

  const handleClick = (): void => {
    console.log('> SearchOptionRow -> handleClick:', { address: option.address, domId });
    onChoose(option.address);
  };

  const handlePointerMove = (): void => {
    if (!isActive) {
      onActivate(domId);
    }
  };

  return (
    <div
      aria-selected={isActive}
      className={ROW_CLASS_NAME}
      data-testid={`global-search-option-${option.groupId}-${option.objectId}`}
      id={domId}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      role="option"
    >
      <Icon aria-hidden className={ICON_CLASS_NAME} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="sr-only">{t(SEARCH_OPTION_KIND_KEYS[option.detail.kind])}</span>
        <span className={TITLE_CLASS_NAME} translate="no">
          <HighlightedText matches={option.titleMatches} text={option.title} />
        </span>
        <SearchOptionDetail option={option} t={t} />
      </div>
    </div>
  );
};
