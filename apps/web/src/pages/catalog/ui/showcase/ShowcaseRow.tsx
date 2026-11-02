import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { ReactElement } from 'react';

import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { CalendarDays } from 'lucide-react';
import {
  useEffect,
  useRef,
} from 'react';

import {
  AvailabilityBadge,
  pickOfferAvailability,
} from '@/entities/listing';
import { VerificationBadge } from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';
import { AddressLink } from '@/shared/routing';

import { formatEtaDate } from '../../lib/formatEtaDate';
import { formatListingQuantity } from '../../lib/formatListingQuantity';
import { resolveScrollBehavior } from '../../lib/resolveScrollBehavior';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { CATALOG_ROW_CLASS_NAME } from './catalogRowStyles';

const QUOTE_COLUMN_CLASS_NAME = [
  'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line pt-2',
  '@lg:w-36 @lg:flex-col @lg:items-end @lg:justify-start @lg:border-t-0 @lg:pt-0 @lg:text-right',
].join(' ');

const NO_ROUTE_CLASS_NAME = [
  'border-t border-line pt-2 text-sm leading-5 text-on-panel-muted',
  '@lg:w-36 @lg:border-t-0 @lg:pt-0 @lg:text-right',
].join(' ');

const TOTAL_CLASS_NAME = 'text-lg leading-6 font-semibold tracking-tight whitespace-nowrap text-on-panel tabular-nums';

interface ShowcaseRowProps {
  isSelected: boolean;
  listing: ShowcaseListing;
}

export const ShowcaseRow = ({ isSelected, listing }: ShowcaseRowProps): ReactElement => {
  const { formatCalendarDate, locale } = useI18n();
  const { listingT } = useCatalogTexts();
  const linkRef = useRef<HTMLAnchorElement>(null);

  const { priceUnit, supplier } = listing;
  const [quote] = listing.quotes;
  const unitPrice = quote?.unitPrice ?? listing.tiers[0]?.price;
  const availability = pickOfferAvailability(listing);
  const minQuantityText = formatListingQuantity(locale, listing, listing.minOrderQuantity, listingT);
  const etaText = formatEtaDate(formatCalendarDate, quote?.etaDate);

  const unitPriceText = unitPrice === undefined || priceUnit === undefined
    ? undefined
    : listingT('listing.price.perUnit', { price: formatMoney(locale, unitPrice), unit: priceUnit.name });
  const totalText = quote?.total === undefined ? undefined : formatMoney(locale, quote.total);
  const deliveryText = quote?.method === DeliveryMethod.SUPPLIER
    ? listingT('listing.quote.withDelivery')
    : listingT('listing.quote.withoutDelivery');
  const isQuoteShown = totalText !== undefined;

  useEffect(() => {
    if (isSelected) {
      linkRef.current?.scrollIntoView({ behavior: resolveScrollBehavior(), block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <li>
      <AddressLink
        aria-current={isSelected ? 'true' : undefined}
        className={CATALOG_ROW_CLASS_NAME}
        data-testid={`catalog-showcase-row-${listing.id}`}
        ref={linkRef}
        to={{ kind: 'object', object: { id: listing.id, type: 'listing' } }}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 text-base leading-6 font-semibold text-on-panel" translate="no">
            {listing.productName}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="sr-only">{listingT('listing.sr.supplier')}</span>
            <span className="truncate text-sm leading-5 text-on-panel-muted" translate="no">{supplier?.name}</span>
            <VerificationBadge isCompact level={supplier?.verificationLevel ?? 0} />
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {unitPriceText !== undefined && (
              <span className="text-base leading-6 font-medium whitespace-nowrap tabular-nums">
                <span className="sr-only">{listingT('listing.sr.unitPrice')}</span>
                {unitPriceText}
              </span>
            )}
            {minQuantityText !== undefined && (
              <span className="text-sm leading-5 whitespace-nowrap text-on-panel-muted tabular-nums">
                {listingT('listing.minOrder', { quantity: minQuantityText })}
              </span>
            )}
            {availability !== undefined && (
              <span className="inline-flex items-center">
                <span className="sr-only">{listingT('listing.sr.availability')}</span>
                <AvailabilityBadge status={availability} />
              </span>
            )}
          </span>
        </span>
        {isQuoteShown
          ? (
              <span className={QUOTE_COLUMN_CLASS_NAME}>
                <span className="flex flex-col @lg:items-end">
                  <span className={TOTAL_CLASS_NAME}>
                    <span className="sr-only">{listingT('listing.sr.total')}</span>
                    {totalText}
                  </span>
                  <span className="text-sm leading-5 text-on-panel-muted">{deliveryText}</span>
                </span>
                <span className="flex items-center gap-1 text-sm leading-5 text-on-panel">
                  <CalendarDays aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
                  <span className="sr-only">{listingT('listing.sr.eta')}</span>
                  <span className="tabular-nums">{etaText ?? listingT('listing.quote.etaUnknown')}</span>
                </span>
              </span>
            )
          : (
              <span className={NO_ROUTE_CLASS_NAME}>
                {listingT('listing.quote.noRoute')}
              </span>
            )}
      </AddressLink>
    </li>
  );
};
