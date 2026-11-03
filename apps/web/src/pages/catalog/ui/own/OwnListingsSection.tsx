import type { ReactElement } from 'react';

import {
  useId,
  useMemo,
} from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useOwnListingsQuery } from '@/entities/listing';
import {
  Button,
  ErrorNotice,
  WidgetStates,
} from '@/shared/ui';

import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

import { toOwnListingPairs } from '../../lib/toOwnListingPairs';
import { useFocusNewRows } from '../../lib/useFocusNewRows';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { OwnListSkeleton } from '../skeleton/OwnListSkeleton';
import { OwnEmpty } from './OwnEmpty';
import { OwnListingsPage } from './OwnListingsPage';

type OwnListingPagesValue = readonly (readonly OwnListingPairValue[])[];

interface OwnListingsSectionProps {
  focus: ObjectRefValue | undefined;
}

const isCatalogEmpty = (pages: OwnListingPagesValue): boolean => pages.every(page => page.length === 0);

export const OwnListingsSection = ({ focus }: OwnListingsSectionProps): ReactElement => {
  const { t } = useCatalogTexts();
  const titleId = useId();
  const listQuery = useOwnListingsQuery();

  const sourcePages = listQuery.data?.pages;
  const pages = useMemo(() => sourcePages?.map(page => toOwnListingPairs(page.items)), [sourcePages]);
  const rowCount = pages?.reduce((total, page) => total + page.length, 0);
  const { expectNewRows, listRef } = useFocusNewRows(rowCount);

  const selectedListingId = focus?.type === 'listing' ? focus.id : undefined;
  const isNextPageFailed = listQuery.isFetchNextPageError;
  const isMoreShown = listQuery.hasNextPage && !isNextPageFailed;
  const isListRefreshing = listQuery.isFetching && !listQuery.isFetchingNextPage;

  const handleRetry = (): void => {
    console.log('> OwnListingsSection -> handleRetry:', {});
    void listQuery.refetch();
  };

  const handleMoreClick = (): void => {
    console.log('> OwnListingsSection -> handleMoreClick:', { shown: rowCount });
    expectNewRows();
    void listQuery.fetchNextPage();
  };

  const handleNextPageRetry = (): void => {
    console.log('> OwnListingsSection -> handleNextPageRetry:', { shown: rowCount });
    expectNewRows();
    void listQuery.fetchNextPage();
  };

  return (
    <section aria-labelledby={titleId} className="@container flex flex-col gap-2">
      <h2 className="text-base leading-6 font-semibold text-on-panel" id={titleId}>{t('catalog.own.listTitle')}</h2>
      <WidgetStates
        data={pages}
        empty={<OwnEmpty />}
        error={listQuery.error}
        isEmpty={isCatalogEmpty}
        isRetrying={listQuery.isFetching}
        loadingLabel={t('catalog.own.loading')}
        onRetry={handleRetry}
        skeleton={<OwnListSkeleton />}
      >
        {loadedPages => (
          <div className="flex flex-col gap-3">
            <p aria-live="polite" className="sr-only">{t('catalog.showcase.shown', { count: rowCount ?? 0 })}</p>
            <ul
              aria-busy={isListRefreshing ? 'true' : undefined}
              className="flex flex-col gap-2"
              data-testid="catalog-own-list"
              ref={listRef}
            >
              {loadedPages.map((pairs, pageIndex) => (
                <OwnListingsPage
                  key={pairs[0]?.listing.id ?? `page-${String(pageIndex)}`}
                  pairs={pairs}
                  selectedListingId={selectedListingId}
                />
              ))}
            </ul>
            {isNextPageFailed && (
              <ErrorNotice error={listQuery.error} isRetrying={listQuery.isFetchingNextPage} onRetry={handleNextPageRetry} />
            )}
            {isMoreShown && (
              <Button
                className="self-center"
                data-testid="catalog-own-show-more"
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
    </section>
  );
};
