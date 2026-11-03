import type { PriceTier } from '@skladburg/contracts/catalog/v1/catalog';
import type { ReactElement } from 'react';

import { useId } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatMoney } from '@/shared/lib/money';

import type { QuantityUnitsValue } from '../../lib/formatListingQuantity';

import { formatListingQuantity } from '../../lib/formatListingQuantity';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { INSPECTOR_HEADING_CLASS_NAME } from './inspectorStyles';

interface ListingTiersTableProps {
  currentTier: PriceTier | undefined;
  tiers: readonly PriceTier[];
  units: QuantityUnitsValue;
}

const CELL_CLASS_NAME = 'border-b border-line py-2 text-base tabular-nums group-last/row:border-b-0';

export const ListingTiersTable = ({ currentTier, tiers, units }: ListingTiersTableProps): ReactElement => {
  const { locale } = useI18n();
  const { listingT } = useCatalogTexts();
  const titleId = useId();

  const { priceUnit } = units;

  return (
    <section className="flex flex-col gap-1" data-testid="listing-tiers">
      <h3 className={INSPECTOR_HEADING_CLASS_NAME} id={titleId}>{listingT('listing.tiers.title')}</h3>
      <table aria-labelledby={titleId} className="w-full border-collapse">
        <thead>
          <tr className="text-sm leading-5 text-on-panel-muted">
            <th className="py-1 text-left font-normal" scope="col">{listingT('listing.tiers.from')}</th>
            <th className="py-1 text-right font-normal" scope="col">{listingT('listing.tiers.price')}</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => {
            const isCurrent = tier === currentTier;
            const quantityText = formatListingQuantity(locale, units, tier.minQuantity, listingT);
            const priceText = tier.price === undefined || priceUnit === undefined
              ? undefined
              : listingT('listing.price.perUnit', { price: formatMoney(locale, tier.price), unit: priceUnit.name });

            return (
              <tr
                aria-current={isCurrent ? 'true' : undefined}
                className={isCurrent ? 'group/row bg-hover font-semibold' : 'group/row'}
                key={tier.minQuantity.toString()}
              >
                <td className={CELL_CLASS_NAME}>
                  {quantityText}
                  {isCurrent && (
                    <span className="block text-xs leading-4 font-normal text-on-panel-muted">{listingT('listing.tiers.current')}</span>
                  )}
                </td>
                <td className={cn(CELL_CLASS_NAME, 'text-right whitespace-nowrap')}>{priceText}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};
