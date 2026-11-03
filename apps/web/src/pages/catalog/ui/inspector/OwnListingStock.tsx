import type { ReactElement } from 'react';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

import { AvailabilityBadge } from '@/entities/listing';
import { useI18n } from '@/shared/i18n';
import { WidgetStates } from '@/shared/ui';

import type { DestinationOptionValue } from '../../lib/destinationOptions';
import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

import { useOwnWarehouseOptions } from '../../api/useOwnWarehouseOptions';
import { formatDestinationLabel } from '../../lib/formatDestinationLabel';
import { formatListingQuantity } from '../../lib/formatListingQuantity';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { OwnWarehousesSkeleton } from '../skeleton/OwnWarehousesSkeleton';
import {
  INSPECTOR_HEADING_CLASS_NAME,
  INSPECTOR_NUMBERS_CLASS_NAME,
} from './inspectorStyles';

interface OwnListingStockProps {
  pair: OwnListingPairValue;
}

export const OwnListingStock = ({ pair }: OwnListingStockProps): ReactElement => {
  const { locale } = useI18n();
  const { listingT, t } = useCatalogTexts();
  const warehouses = useOwnWarehouseOptions();

  const { listing, product } = pair;
  const units = { baseUnit: product.baseUnit, priceUnit: listing.priceUnit };

  const getWarehouseLabel = (options: readonly DestinationOptionValue[], warehouseId: string): string => {
    const option = options.find(candidate => candidate.id === warehouseId);

    return option === undefined ? warehouseId : formatDestinationLabel(t, option);
  };

  if (listing.availability.length === 0) {
    return (
      <section className="flex flex-col gap-2" data-testid="listing-own-stock">
        <h3 className={INSPECTOR_HEADING_CLASS_NAME}>{t('catalog.own.stockTitle')}</h3>
        <p className="text-sm leading-5 text-on-panel-muted">{t('catalog.own.stockNoneHint')}</p>
      </section>
    );
  }

  return (
    <WidgetStates
      data={warehouses.isPending ? undefined : warehouses.options}
      error={warehouses.error}
      isRetrying={warehouses.isRetrying}
      loadingLabel={listingT('listing.loading')}
      onRetry={warehouses.retry}
      skeleton={<OwnWarehousesSkeleton />}
    >
      {options => (
        <section className="flex flex-col gap-2" data-testid="listing-own-stock">
          <h3 className={INSPECTOR_HEADING_CLASS_NAME}>{t('catalog.own.stockTitle')}</h3>
          <ul className="flex flex-col gap-2">
            {listing.availability.map((entry) => {
              const isStatusShown = entry.status !== AvailabilityStatus.UNSPECIFIED;
              const quantityText = entry.quantity > 0n ? formatListingQuantity(locale, units, entry.quantity, listingT) : undefined;

              return (
                <li className="flex flex-col gap-1 rounded-control border border-line p-3" key={entry.warehouseId}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-base leading-6 font-semibold text-on-panel" translate="no">
                      {getWarehouseLabel(options, entry.warehouseId)}
                    </span>
                    {isStatusShown && <AvailabilityBadge status={entry.status} />}
                  </div>
                  {quantityText !== undefined && (
                    <p className={INSPECTOR_NUMBERS_CLASS_NAME}>{t('catalog.own.stockLeft', { quantity: quantityText })}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </WidgetStates>
  );
};
