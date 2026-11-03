import type {
  BaseUnit,
  PriceUnit,
} from '@skladburg/contracts/catalog/v1/catalog';

import type { ListingTranslate } from '@/entities/listing';
import type { LocaleCode } from '@/shared/i18n';

import {
  formatQuantity,
  getBaseUnitLabelKey,
} from '@/entities/listing';

export interface QuantityUnitsValue {
  baseUnit: BaseUnit;
  priceUnit?: PriceUnit | undefined;
}

export const formatListingQuantity = (
  locale: LocaleCode,
  listing: QuantityUnitsValue,
  baseQuantity: bigint,
  listingT: ListingTranslate,
): string | undefined => {
  const { priceUnit } = listing;
  const baseUnitLabelKey = getBaseUnitLabelKey(listing.baseUnit);

  if (priceUnit === undefined || baseUnitLabelKey === undefined) {
    return undefined;
  }

  return formatQuantity(locale, baseQuantity, priceUnit, listingT(baseUnitLabelKey));
};
