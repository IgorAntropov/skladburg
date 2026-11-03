import type {
  Listing,
  Product,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { useMemo } from 'react';

import { useListingPricesQuery } from '@/entities/listing';
import { useCan } from '@/entities/session';
import { WidgetStates } from '@/shared/ui';

import type { DestinationOptionValue } from '../../lib/destinationOptions';

import { useOwnWarehouseOptions } from '../../api/useOwnWarehouseOptions';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { OwnWarehousesSkeleton } from '../skeleton/OwnWarehousesSkeleton';
import { ListingPositionForm } from './ListingPositionForm';

interface ListingPositionSectionProps {
  isReloading: boolean;
  listing: Listing;
  onDirtyChange: (isDirty: boolean) => void;
  onReload: () => void;
  onSaved: (saved: Listing) => void;
  product: Product;
}

interface PositionDataValue {
  isUnitLocked: boolean;
  warehouses: readonly DestinationOptionValue[];
}

const NO_LISTING_IDS: readonly string[] = [];

export const ListingPositionSection = ({
  isReloading,
  listing,
  onDirtyChange,
  onReload,
  onSaved,
  product,
}: ListingPositionSectionProps): ReactElement => {
  const { listingT } = useCatalogTexts();
  const warehouses = useOwnWarehouseOptions();
  const canViewPrices = useCan(PermissionCode.PRICE_LIST_VIEW);
  const listingIds = useMemo(() => (canViewPrices ? [listing.id] : NO_LISTING_IDS), [canViewPrices, listing.id]);
  const pricesQuery = useListingPricesQuery(listingIds);

  const prices = pricesQuery.data;
  const error = warehouses.error ?? pricesQuery.error;
  const isPending = warehouses.isPending || (canViewPrices && prices === undefined);
  const data = useMemo<PositionDataValue | undefined>(
    () => (isPending ? undefined : { isUnitLocked: prices?.has(listing.id) === true, warehouses: warehouses.options }),
    [isPending, listing.id, prices, warehouses.options],
  );

  const handleRetry = (): void => {
    console.log('> ListingPositionSection -> handleRetry:', { listingId: listing.id });
    warehouses.retry();

    if (pricesQuery.error !== null) {
      void pricesQuery.refetch();
    }
  };

  return (
    <WidgetStates
      data={data}
      error={error}
      isRetrying={warehouses.isRetrying || pricesQuery.isFetching}
      loadingLabel={listingT('listing.loading')}
      onRetry={handleRetry}
      skeleton={<OwnWarehousesSkeleton />}
    >
      {loaded => (
        <ListingPositionForm
          isReloading={isReloading}
          isUnitLocked={loaded.isUnitLocked}
          listing={listing}
          onDirtyChange={onDirtyChange}
          onReload={onReload}
          onSaved={onSaved}
          product={product}
          warehouses={loaded.warehouses}
        />
      )}
    </WidgetStates>
  );
};
