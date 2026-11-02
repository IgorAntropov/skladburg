import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { ReactElement } from 'react';

import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { CalendarDays } from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';
import { TextLink } from '@/shared/ui';

import type { DestinationOptionValue } from '../../lib/destinationOptions';

import { formatEtaDate } from '../../lib/formatEtaDate';
import { formatListingQuantity } from '../../lib/formatListingQuantity';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import {
  INSPECTOR_KICKER_CLASS_NAME,
  INSPECTOR_NUMBERS_CLASS_NAME,
} from './inspectorStyles';

interface ListingQuoteBlockProps {
  cityNames: ReadonlyMap<string, string>;
  destination: DestinationOptionValue | undefined;
  listing: ShowcaseListing;
}

interface QuoteLineProps {
  label: string;
  value: string;
}

const BLOCK_CLASS_NAME = 'flex flex-col gap-2 rounded-control border border-line p-3';

const TOTAL_CLASS_NAME = 'text-2xl leading-8 font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere]';

const QuoteLine = ({ label, value }: QuoteLineProps): ReactElement => (
  <div className="flex justify-between gap-3 text-sm leading-5">
    <dt className="text-on-panel-muted">{label}</dt>
    <dd className="text-right tabular-nums [overflow-wrap:anywhere] text-on-panel">{value}</dd>
  </div>
);

export const ListingQuoteBlock = ({ cityNames, destination, listing }: ListingQuoteBlockProps): ReactElement => {
  const { formatCalendarDate, formatNumber, locale } = useI18n();
  const { listingT, t } = useCatalogTexts();

  const [quote] = listing.quotes;

  if (destination === undefined) {
    return (
      <div className={BLOCK_CLASS_NAME} data-testid="listing-quote">
        <p className="text-sm leading-5">{listingT('listing.quote.noWarehouse')}</p>
        <TextLink size="sm" to={{ kind: 'section', section: 'warehouse' }}>{t('catalog.empty.noWarehouse.action')}</TextLink>
      </div>
    );
  }

  const destinationLabel = destination.cityName === ''
    ? destination.warehouseName
    : t('catalog.filter.destinationOption', { city: destination.cityName, warehouse: destination.warehouseName });
  const toWarehouseText = listingT('listing.quote.toWarehouse', { warehouse: destinationLabel });

  if (quote?.total === undefined) {
    return (
      <div className={BLOCK_CLASS_NAME} data-testid="listing-quote">
        <p className={INSPECTOR_KICKER_CLASS_NAME}>{toWarehouseText}</p>
        <p className="text-base leading-6">{listingT('listing.quote.noRoute')}</p>
      </div>
    );
  }

  const isSupplierDelivery = quote.method === DeliveryMethod.SUPPLIER;
  const etaText = formatEtaDate(formatCalendarDate, quote.etaDate) ?? listingT('listing.quote.etaUnknown');
  const quantityText = formatListingQuantity(locale, listing, quote.quantity, listingT);
  const unitPriceText = quote.unitPrice === undefined || listing.priceUnit === undefined
    ? undefined
    : listingT('listing.price.perUnit', { price: formatMoney(locale, quote.unitPrice), unit: listing.priceUnit.name });
  const shipFromName = cityNames.get(quote.shipFromCityId);

  return (
    <div className={BLOCK_CLASS_NAME} data-testid="listing-quote">
      <p className={INSPECTOR_KICKER_CLASS_NAME}>{toWarehouseText}</p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="sr-only">{listingT('listing.sr.total')}</span>
        <span className={TOTAL_CLASS_NAME} data-testid="listing-quote-total">{formatMoney(locale, quote.total)}</span>
        <span className="text-sm font-normal text-on-panel-muted">
          {isSupplierDelivery ? listingT('listing.quote.withDelivery') : listingT('listing.quote.withoutDelivery')}
        </span>
      </p>
      <p className="flex items-center gap-1 text-base leading-6 text-on-panel">
        <CalendarDays aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
        <span className="sr-only">{listingT('listing.sr.eta')}</span>
        <span data-testid="listing-quote-eta">{etaText}</span>
      </p>
      {quantityText !== undefined && unitPriceText !== undefined && (
        <p className={INSPECTOR_NUMBERS_CLASS_NAME}>
          {listingT('listing.quote.basis', { price: unitPriceText, quantity: quantityText })}
        </p>
      )}
      <dl className="flex flex-col gap-1 border-t border-line pt-2">
        {quote.goodsTotal !== undefined && (
          <QuoteLine label={listingT('listing.quote.goods')} value={formatMoney(locale, quote.goodsTotal)} />
        )}
        {isSupplierDelivery && quote.deliveryPrice !== undefined && (
          <QuoteLine label={listingT('listing.quote.delivery')} value={formatMoney(locale, quote.deliveryPrice)} />
        )}
        <QuoteLine
          label={listingT('listing.quote.distance')}
          value={listingT('listing.quote.distanceValue', { km: formatNumber(quote.distanceKm) })}
        />
        {shipFromName !== undefined && <QuoteLine label={listingT('listing.quote.shipFrom')} value={shipFromName} />}
      </dl>
    </div>
  );
};
