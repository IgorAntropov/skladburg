import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { useMemo } from 'react';

import { useListingPricesQuery } from '@/entities/listing';
import { useCan } from '@/entities/session';
import { WidgetStates } from '@/shared/ui';

import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

import { useCatalogTexts } from '../../model/useCatalogTexts';
import { OwnTiersSkeleton } from '../skeleton/OwnTiersSkeleton';
import { INSPECTOR_HEADING_CLASS_NAME } from './inspectorStyles';
import { ListingTiersTable } from './ListingTiersTable';

interface OwnListingTiersProps {
  pair: OwnListingPairValue;
}

export const OwnListingTiers = ({ pair }: OwnListingTiersProps): ReactElement | undefined => {
  const { listingT, t } = useCatalogTexts();
  const canViewPrices = useCan(PermissionCode.PRICE_LIST_VIEW);

  const { listing, product } = pair;
  const listingIds = useMemo(() => (canViewPrices ? [listing.id] : []), [canViewPrices, listing.id]);
  const pricesQuery = useListingPricesQuery(listingIds);

  const handleRetry = (): void => {
    console.log('> OwnListingTiers -> handleRetry:', { listingId: listing.id });
    void pricesQuery.refetch();
  };

  if (!canViewPrices) {
    return undefined;
  }

  return (
    <WidgetStates
      data={pricesQuery.data}
      error={pricesQuery.error}
      isRetrying={pricesQuery.isFetching}
      loadingLabel={listingT('listing.loading')}
      onRetry={handleRetry}
      skeleton={<OwnTiersSkeleton />}
    >
      {(prices) => {
        const tiers = prices.get(listing.id)?.tiers ?? [];

        if (tiers.length === 0) {
          return (
            <section className="flex flex-col gap-1" data-testid="listing-tiers">
              <h3 className={INSPECTOR_HEADING_CLASS_NAME}>{listingT('listing.tiers.title')}</h3>
              <p className="text-sm leading-5 text-on-panel-muted">{t('catalog.own.priceNoneHint')}</p>
            </section>
          );
        }

        return (
          <ListingTiersTable
            currentTier={undefined}
            tiers={tiers}
            units={{ baseUnit: product.baseUnit, priceUnit: listing.priceUnit }}
          />
        );
      }}
    </WidgetStates>
  );
};
