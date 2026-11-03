import type { ReactElement } from 'react';

import {
  useEffect,
  useState,
} from 'react';

import type { AppAddressValue } from '@/shared/routing';

import {
  ErrorNotice,
  useDelayedVisibility,
} from '@/shared/ui';

import type { GlobalSearchTranslate } from '../../i18n/globalSearchSection';
import type { SearchGroupValue } from '../../model/searchResultTypes';

import { SearchGroupSkeleton } from './SearchGroupSkeleton';
import { SearchOptionRow } from './SearchOptionRow';
import {
  SEARCH_GROUP_TITLE_KEYS,
  toGroupHeadingDomId,
  toOptionDomId,
} from './searchPanelConfig';

const GROUP_CLASS_NAME = 'not-first:border-t not-first:border-line';

const HEADING_CLASS_NAME = 'px-3 pt-3 pb-1 text-sm leading-5 font-semibold text-on-panel-muted';

interface SearchGroupSectionProps {
  activeId: string | undefined;
  group: SearchGroupValue;
  listboxId: string;
  onActivate: (domId: string) => void;
  onChoose: (address: AppAddressValue) => void;
  onSkeletonHold: () => () => void;
  t: GlobalSearchTranslate;
}

export const SearchGroupSection = ({
  activeId,
  group,
  listboxId,
  onActivate,
  onChoose,
  onSkeletonHold,
  t,
}: SearchGroupSectionProps): ReactElement => {
  const [retriedError, setRetriedError] = useState<Error | null>(null);

  const isLoading = group.status === 'loading';
  const isSkeletonFilled = useDelayedVisibility(isLoading);
  const isSkeletonHeld = group.status === 'ready' && isSkeletonFilled;
  const isSkeletonShown = isLoading || isSkeletonHeld;
  const isSkeletonVisible = isSkeletonFilled && isSkeletonShown;
  const isHeadingHidden = isLoading && !isSkeletonFilled;
  const isErrorShown = group.status === 'error';
  const isOptionsShown = group.status === 'ready' && !isSkeletonShown;
  const isRetrying = group.error !== null && retriedError === group.error;
  const headingId = toGroupHeadingDomId(listboxId, group.id);

  const handleRetry = (): void => {
    console.log('> SearchGroupSection -> handleRetry:', { groupId: group.id });
    setRetriedError(group.error);
    group.retry();
  };

  useEffect(() => {
    if (!isSkeletonVisible) {
      return undefined;
    }

    return onSkeletonHold();
  }, [isSkeletonVisible, onSkeletonHold]);

  return (
    <div
      aria-labelledby={headingId}
      className={GROUP_CLASS_NAME}
      data-testid={`global-search-group-${group.id}`}
      role="group"
    >
      <div className={isHeadingHidden ? `${HEADING_CLASS_NAME} invisible` : HEADING_CLASS_NAME} id={headingId}>
        {t(SEARCH_GROUP_TITLE_KEYS[group.id])}
      </div>
      {isSkeletonShown && <SearchGroupSkeleton isFilled={isSkeletonFilled} label={t('globalSearch.loading')} />}
      {isErrorShown && (
        <div className="px-3 py-2" data-testid={`global-search-group-error-${group.id}`}>
          <ErrorNotice error={group.error} isRetrying={isRetrying} onRetry={handleRetry} />
        </div>
      )}
      {isOptionsShown && group.options.map((option) => {
        const domId = toOptionDomId(listboxId, group.id, option.objectId);

        return (
          <SearchOptionRow
            domId={domId}
            isActive={domId === activeId}
            key={option.objectId}
            onActivate={onActivate}
            onChoose={onChoose}
            option={option}
            t={t}
          />
        );
      })}
      {isOptionsShown && group.hasMore && (
        <p className="px-3 pb-2 text-sm leading-5 text-on-panel-muted">{t('globalSearch.group.more')}</p>
      )}
    </div>
  );
};
