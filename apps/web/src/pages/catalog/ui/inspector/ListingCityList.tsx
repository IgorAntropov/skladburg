import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { ReactElement } from 'react';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import { useMemo } from 'react';

import { AvailabilityBadge } from '@/entities/listing';
import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';

import { buildCityRows } from '../../lib/buildCityRows';
import { formatEtaDate } from '../../lib/formatEtaDate';
import { formatListingQuantity } from '../../lib/formatListingQuantity';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import {
  INSPECTOR_HEADING_CLASS_NAME,
  INSPECTOR_KICKER_CLASS_NAME,
  INSPECTOR_NUMBERS_CLASS_NAME,
} from './inspectorStyles';

interface ListingCityListProps {
  cityNames: ReadonlyMap<string, string>;
  listing: ShowcaseListing;
}

export const ListingCityList = ({ cityNames, listing }: ListingCityListProps): ReactElement => {
  const { formatCalendarDate, locale } = useI18n();
  const { listingT } = useCatalogTexts();

  const rows = useMemo(() => buildCityRows(listing, cityNames), [cityNames, listing]);

  return (
    <section className="flex flex-col gap-2" data-testid="listing-city-availability">
      <div className="flex flex-col">
        <h3 className={INSPECTOR_HEADING_CLASS_NAME}>{listingT('listing.cities.title')}</h3>
        <p className={INSPECTOR_KICKER_CLASS_NAME}>{listingT('listing.cities.hint')}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const status = row.availability?.status;
          const isStatusShown = status !== undefined && status !== AvailabilityStatus.UNSPECIFIED;
          const isStockShown = row.availability !== undefined && status !== AvailabilityStatus.ON_ORDER;
          const stockText = row.availability === undefined
            ? undefined
            : formatListingQuantity(locale, listing, row.availability.quantity, listingT);
          const etaText = formatEtaDate(formatCalendarDate, row.quote?.etaDate) ?? listingT('listing.quote.etaUnknown');

          return (
            <li className="flex flex-col gap-1 rounded-control border border-line p-3" key={row.cityId}>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-base leading-6 font-semibold text-on-panel" translate="no">{row.cityName}</span>
                {isStatusShown && <AvailabilityBadge status={status} />}
              </div>
              {isStockShown && stockText !== undefined && (
                <p className={INSPECTOR_NUMBERS_CLASS_NAME}>{listingT('listing.cities.stock', { quantity: stockText })}</p>
              )}
              {row.quote?.total === undefined
                ? <p className="text-sm leading-5 text-on-panel-muted">{listingT('listing.cities.noRoute')}</p>
                : (
                    <p className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm leading-5">
                      <span className="font-semibold tabular-nums">
                        {listingT('listing.cities.total', { total: formatMoney(locale, row.quote.total) })}
                      </span>
                      <span className="tabular-nums text-on-panel-muted">{etaText}</span>
                    </p>
                  )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
