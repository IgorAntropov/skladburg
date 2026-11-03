import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { ReactElement } from 'react';

import { useMemo } from 'react';

import type { ShowcaseListParamsValue } from '@/entities/listing';
import type { ObjectRefValue } from '@/shared/routing';

import { useShowcaseListingsQuery } from '@/entities/listing';
import {
  Button,
  ErrorNotice,
  WidgetStates,
} from '@/shared/ui';

import { useFocusNewRows } from '../../lib/useFocusNewRows';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { ShowcaseEmpty } from './ShowcaseEmpty';
import { ShowcaseList } from './ShowcaseList';
import { ShowcaseListSkeleton } from './ShowcaseListSkeleton';

interface ShowcaseResultsProps {
  focus: ObjectRefValue | undefined;
  isFiltered: boolean;
  onReset: () => void;
  params: ShowcaseListParamsValue;
}

const isListingsEmpty = (listings: readonly ShowcaseListing[]): boolean => listings.length === 0;

export const ShowcaseResults = ({ focus, isFiltered, onReset, params }: ShowcaseResultsProps): ReactElement => {
  const { t } = useCatalogTexts();
  const listQuery = useShowcaseListingsQuery(params);

  const listings = useMemo(() => listQuery.data?.pages.flatMap(page => page.items), [listQuery.data]);
  const { expectNewRows, listRef } = useFocusNewRows(listings?.length);
  const selectedListingId = focus?.type === 'listing' ? focus.id : undefined;
  const isNextPageFailed = listQuery.isFetchNextPageError;
  const isMoreShown = listQuery.hasNextPage && !isNextPageFailed;

  const handleRetry = (): void => {
    console.log('> ShowcaseResults -> handleRetry:', {});
    void listQuery.refetch();
  };

  const handleMoreClick = (): void => {
    console.log('> ShowcaseResults -> handleMoreClick:', { shown: listings?.length });
    expectNewRows();
    void listQuery.fetchNextPage();
  };

  const handleNextPageRetry = (): void => {
    console.log('> ShowcaseResults -> handleNextPageRetry:', { shown: listings?.length });
    expectNewRows();
    void listQuery.fetchNextPage();
  };

  return (
    <WidgetStates
      data={listings}
      empty={<ShowcaseEmpty isFiltered={isFiltered} onReset={onReset} />}
      error={listQuery.error}
      isEmpty={isListingsEmpty}
      isRetrying={listQuery.isFetching}
      loadingLabel={t('catalog.showcase.loading')}
      onRetry={handleRetry}
      skeleton={<ShowcaseListSkeleton />}
    >
      {loadedListings => (
        <div className="@container flex flex-col gap-3">
          <p aria-live="polite" className="sr-only">{t('catalog.showcase.shown', { count: loadedListings.length })}</p>
          <ShowcaseList
            isBusy={listQuery.isPlaceholderData}
            listings={loadedListings}
            listRef={listRef}
            selectedListingId={selectedListingId}
          />
          {isNextPageFailed && (
            <ErrorNotice error={listQuery.error} isRetrying={listQuery.isFetchingNextPage} onRetry={handleNextPageRetry} />
          )}
          {isMoreShown && (
            <Button
              className="self-center"
              data-testid="catalog-show-more"
              onClick={handleMoreClick}
              pending={listQuery.isFetchingNextPage}
              pendingLabel={t('catalog.showcase.moreLoading')}
              variant="secondary"
            >
              {t('catalog.showcase.more')}
            </Button>
          )}
        </div>
      )}
    </WidgetStates>
  );
};
