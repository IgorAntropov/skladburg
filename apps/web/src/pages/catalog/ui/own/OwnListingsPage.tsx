import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { useMemo } from 'react';

import { useListingPricesQuery } from '@/entities/listing';
import { useCan } from '@/entities/session';
import { ErrorNotice } from '@/shared/ui';

import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

import { resolveRowPrice } from '../../lib/resolveRowPrice';
import { OwnListingRow } from './OwnListingRow';

interface OwnListingsPageProps {
  pairs: readonly OwnListingPairValue[];
  selectedListingId: string | undefined;
}

const NO_LISTING_IDS: readonly string[] = [];

export const OwnListingsPage = ({ pairs, selectedListingId }: OwnListingsPageProps): ReactElement => {
  const canViewPrices = useCan(PermissionCode.PRICE_LIST_VIEW);

  const listingIds = useMemo(
    () => (canViewPrices ? pairs.map(pair => pair.listing.id) : NO_LISTING_IDS),
    [canViewPrices, pairs],
  );
  const pricesQuery = useListingPricesQuery(listingIds);

  const isPricesFailed = pricesQuery.isError;

  const handlePricesRetry = (): void => {
    console.log('> OwnListingsPage -> handlePricesRetry:', { count: listingIds.length });
    void pricesQuery.refetch();
  };

  return (
    <>
      {isPricesFailed && (
        <li>
          <ErrorNotice error={pricesQuery.error} isRetrying={pricesQuery.isFetching} onRetry={handlePricesRetry} />
        </li>
      )}
      {pairs.map(pair => (
        <OwnListingRow
          isSelected={pair.listing.id === selectedListingId}
          key={pair.listing.id}
          pair={pair}
          price={resolveRowPrice({
            canViewPrices,
            isFailed: isPricesFailed,
            listingId: pair.listing.id,
            prices: pricesQuery.data,
          })}
        />
      ))}
    </>
  );
};
