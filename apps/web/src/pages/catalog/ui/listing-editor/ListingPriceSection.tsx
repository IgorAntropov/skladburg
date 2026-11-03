import type {
  Listing,
  ListingPrice,
  Product,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { ReactElement } from 'react';

import { useMemo } from 'react';

import { useListingPricesQuery } from '@/entities/listing';
import { WidgetStates } from '@/shared/ui';

import type { EditSnapshotValue } from '../../model/useEditBaseline';

import { useListingCache } from '../../api/useListingCache';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { useEditBaseline } from '../../model/useEditBaseline';
import { OwnTiersSkeleton } from '../skeleton/OwnTiersSkeleton';
import { ListingPriceForm } from './ListingPriceForm';

interface ListingPriceBoundaryProps extends ListingPriceSectionProps {
  initialPrice: ListingPrice | undefined;
  refetchPrice: () => Promise<EditSnapshotValue<ListingPrice | undefined> | undefined>;
}

interface ListingPriceSectionProps {
  listing: Listing;
  onDirtyChange: (isDirty: boolean) => void;
  onReloaded: () => void;
  product: Product;
}

const ListingPriceBoundary = ({
  initialPrice,
  listing,
  onDirtyChange,
  onReloaded,
  product,
  refetchPrice,
}: ListingPriceBoundaryProps): ReactElement => {
  const cache = useListingCache();
  const priceBaseline = useEditBaseline<ListingPrice | undefined>({
    initial: initialPrice,
    onReloaded,
    refetch: refetchPrice,
  });

  const { accept } = priceBaseline;
  const formKey = `${String(priceBaseline.epoch)}-${String(listing.priceUnit?.baseQuantity ?? 0n)}`;

  const handleSaved = (saved: ListingPrice): void => {
    console.log('> ListingPriceBoundary -> handleSaved:', { version: String(saved.version) });
    cache.storePrice(saved);
    accept(saved);
  };

  return (
    <ListingPriceForm
      isReloading={priceBaseline.isReloading}
      key={formKey}
      listingId={listing.id}
      onDirtyChange={onDirtyChange}
      onReload={priceBaseline.reload}
      onSaved={handleSaved}
      price={priceBaseline.baseline}
      priceUnit={listing.priceUnit}
      product={product}
    />
  );
};

export const ListingPriceSection = ({
  listing,
  onDirtyChange,
  onReloaded,
  product,
}: ListingPriceSectionProps): ReactElement => {
  const { listingT } = useCatalogTexts();
  const listingIds = useMemo(() => [listing.id], [listing.id]);
  const pricesQuery = useListingPricesQuery(listingIds);

  const { refetch } = pricesQuery;

  const refetchPrice = async (): Promise<EditSnapshotValue<ListingPrice | undefined> | undefined> => {
    const result = await refetch();

    return result.isSuccess ? { record: result.data.get(listing.id) } : undefined;
  };

  const handleRetry = (): void => {
    console.log('> ListingPriceSection -> handleRetry:', { listingId: listing.id });
    void refetch();
  };

  return (
    <WidgetStates
      data={pricesQuery.data}
      error={pricesQuery.error}
      isRetrying={pricesQuery.isFetching}
      loadingLabel={listingT('listing.loading')}
      onRetry={handleRetry}
      skeleton={<OwnTiersSkeleton />}
    >
      {prices => (
        <ListingPriceBoundary
          initialPrice={prices.get(listing.id)}
          listing={listing}
          onDirtyChange={onDirtyChange}
          onReloaded={onReloaded}
          product={product}
          refetchPrice={refetchPrice}
        />
      )}
    </WidgetStates>
  );
};
