import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';

import type { ListingTranslate } from '@/entities/listing';
import type { LocaleCode } from '@/shared/i18n';

import {
  formatQuantity,
  getBaseUnitLabelKey,
} from '@/entities/listing';

export const formatListingQuantity = (
  locale: LocaleCode,
  listing: Pick<ShowcaseListing, 'baseUnit' | 'priceUnit'>,
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
