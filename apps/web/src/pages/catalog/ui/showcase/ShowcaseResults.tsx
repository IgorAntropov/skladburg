import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { ReactElement } from 'react';

import { useMemo } from 'react';

import type { ShowcaseListParamsValue } from '@/entities/listing';
import type { ObjectRefValue } from '@/shared/routing';

import { useShowcaseListingsQuery } from '@/entities/listing';
import { WidgetStates } from '@/shared/ui';

import { useCatalogTexts } from '../../model/useCatalogTexts';
import { CatalogResultList } from '../CatalogResultList';
import { ShowcaseEmpty } from './ShowcaseEmpty';
import { ShowcaseListSkeleton } from './ShowcaseListSkeleton';
import { ShowcaseRow } from './ShowcaseRow';

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
  const selectedListingId = focus?.type === 'listing' ? focus.id : undefined;

  const handleRetry = (): void => {
    console.log('> ShowcaseResults -> handleRetry:', {});
    void listQuery.refetch();
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
        <CatalogResultList count={loadedListings.length} isBusy={listQuery.isPlaceholderData} query={listQuery} testId="catalog-showcase">
          {loadedListings.map(listing => (
            <ShowcaseRow isSelected={listing.id === selectedListingId} key={listing.id} listing={listing} />
          ))}
        </CatalogResultList>
      )}
    </WidgetStates>
  );
};
