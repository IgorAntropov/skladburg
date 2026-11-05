import type { ReactElement } from 'react';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import {
  useEffect,
  useRef,
} from 'react';

import {
  AvailabilityBadge,
  PublicationBadge,
  summarizeOwnPrice,
  summarizeOwnStock,
} from '@/entities/listing';
import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';
import { resolveScrollBehavior } from '@/shared/lib/scroll';
import { AddressLink } from '@/shared/routing';
import { Skeleton } from '@/shared/ui';

import type { RowPriceValue } from '../../lib/resolveRowPrice';
import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

import { formatListingQuantity } from '../../lib/formatListingQuantity';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import {
  CATALOG_ROW_AMOUNT_CLASS_NAME,
  CATALOG_ROW_CLASS_NAME,
  CATALOG_ROW_SIDE_COLUMN_CLASS_NAME,
} from '../showcase/catalogRowStyles';

interface OwnListingRowProps {
  isSelected: boolean;
  pair: OwnListingPairValue;
  price: RowPriceValue;
}

export const OwnListingRow = ({ isSelected, pair, price }: OwnListingRowProps): ReactElement => {
  const { locale } = useI18n();
  const { listingT, t } = useCatalogTexts();
  const linkRef = useRef<HTMLAnchorElement>(null);

  const { listing, product } = pair;
  const { priceUnit } = listing;
  const units = { baseUnit: product.baseUnit, priceUnit };

  const stock = summarizeOwnStock(listing.availability);
  const stockQuantityText = stock.kind === 'stock' ? formatListingQuantity(locale, units, stock.quantity, listingT) : undefined;
  const minQuantityText = formatListingQuantity(locale, units, listing.minOrderQuantity, listingT);

  const priceSummary = price.kind === 'ready' ? summarizeOwnPrice(price.price) : undefined;
  const priceText = priceSummary === undefined || priceSummary.kind === 'none' || priceUnit === undefined
    ? undefined
    : listingT('listing.price.perUnit', { price: formatMoney(locale, priceSummary.price), unit: priceUnit.name });
  const unitPriceText = priceSummary?.kind === 'from' && priceText !== undefined
    ? t('catalog.own.priceFrom', { price: priceText })
    : priceText;
  const isPriceMissing = priceSummary?.kind === 'none';

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
        data-testid={`own-listing-row-${listing.id}`}
        ref={linkRef}
        to={{ kind: 'object', object: { id: listing.id, type: 'listing' } }}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 text-base leading-6 font-semibold text-on-panel" translate="no">
            {product.name}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="sr-only">{t('catalog.own.sr.status')}</span>
            <span data-testid={`own-listing-publication-${listing.id}`}>
              <PublicationBadge isPublished={listing.isPublished} />
            </span>
            {product.sku !== '' && (
              <span className="text-sm leading-5 text-on-panel-muted tabular-nums" translate="no">
                {t('catalog.own.sku', { sku: product.sku })}
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-5 tabular-nums">
            {stock.kind === 'none' && <span className="text-on-panel-muted">{t('catalog.own.stockNone')}</span>}
            {stock.kind === 'order-only' && <span className="text-on-panel">{t('catalog.own.stockOrderOnly')}</span>}
            {stock.kind === 'stock' && (
              <>
                <span className="text-on-panel">
                  {t('catalog.own.stock', { count: stock.warehouseCount, quantity: stockQuantityText ?? '' })}
                </span>
                {stock.hasLow && <AvailabilityBadge status={AvailabilityStatus.LOW} />}
              </>
            )}
          </span>
        </span>
        <span className={CATALOG_ROW_SIDE_COLUMN_CLASS_NAME}>
          {price.kind === 'pending' && <Skeleton className="h-6 w-24" />}
          {unitPriceText !== undefined && (
            <span className={CATALOG_ROW_AMOUNT_CLASS_NAME}>
              <span className="sr-only">{t('catalog.own.sr.price')}</span>
              {unitPriceText}
            </span>
          )}
          {isPriceMissing && <span className="text-sm leading-5 text-on-panel-muted">{t('catalog.own.priceNone')}</span>}
          {minQuantityText !== undefined && (
            <span className="text-sm leading-5 whitespace-nowrap text-on-panel-muted tabular-nums">
              {listingT('listing.minOrder', { quantity: minQuantityText })}
            </span>
          )}
        </span>
      </AddressLink>
    </li>
  );
};
