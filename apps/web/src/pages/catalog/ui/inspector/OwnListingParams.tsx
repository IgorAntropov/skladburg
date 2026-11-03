import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';

import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

import { formatListingQuantity } from '../../lib/formatListingQuantity';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import {
  INSPECTOR_HEADING_CLASS_NAME,
  INSPECTOR_SECTION_TITLE_CLASS_NAME,
  INSPECTOR_VALUE_CLASS_NAME,
} from './inspectorStyles';

interface OwnListingParamsProps {
  pair: OwnListingPairValue;
}

export const OwnListingParams = ({ pair }: OwnListingParamsProps): ReactElement => {
  const { locale } = useI18n();
  const { listingT, t } = useCatalogTexts();

  const { listing, product } = pair;
  const units = { baseUnit: product.baseUnit, priceUnit: listing.priceUnit };

  const minOrderText = formatListingQuantity(locale, units, listing.minOrderQuantity, listingT);
  const orderStepText = formatListingQuantity(locale, units, listing.orderStep, listingT);

  return (
    <section className="flex flex-col gap-3" data-testid="listing-own-params">
      <h3 className={INSPECTOR_HEADING_CLASS_NAME}>{t('catalog.own.paramsTitle')}</h3>
      <dl className="flex flex-col gap-3">
        {listing.priceUnit !== undefined && (
          <div>
            <dt className={INSPECTOR_SECTION_TITLE_CLASS_NAME}>{t('catalog.own.unit')}</dt>
            <dd className={INSPECTOR_VALUE_CLASS_NAME}>{listing.priceUnit.name}</dd>
          </div>
        )}
        {minOrderText !== undefined && (
          <div>
            <dt className={INSPECTOR_SECTION_TITLE_CLASS_NAME}>{t('catalog.own.minOrder')}</dt>
            <dd className={INSPECTOR_VALUE_CLASS_NAME}>{minOrderText}</dd>
          </div>
        )}
        {orderStepText !== undefined && (
          <div>
            <dt className={INSPECTOR_SECTION_TITLE_CLASS_NAME}>{t('catalog.own.orderStep')}</dt>
            <dd className={INSPECTOR_VALUE_CLASS_NAME}>{orderStepText}</dd>
          </div>
        )}
      </dl>
    </section>
  );
};
