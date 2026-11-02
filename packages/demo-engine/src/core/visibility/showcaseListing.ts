import type {
  Listing,
  ListingPrice,
  PriceList,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { Organization } from '@skladburg/contracts/organization/v1/organization';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { CalendarDateValue } from '../calendar/index';

import { compareCalendarDates } from '../calendar/index';
import { isProfileVerified } from './organizationVisibility';

export interface ShowcaseListingVisibilityInputValue {
  listing: Listing;
  listingPrice: ListingPrice | undefined;
  priceList: PriceList | undefined;
  supplier: Organization;
  today: CalendarDateValue;
  viewer: Organization;
}

const isPriceListActual = (priceList: PriceList | undefined, today: CalendarDateValue): boolean =>
  priceList?.validUntil === undefined || compareCalendarDates(priceList.validUntil, today) >= 0;

export const isShowcaseListingVisible = (input: ShowcaseListingVisibilityInputValue): boolean => {
  const {
    listing,
    listingPrice,
    priceList,
    supplier,
    today,
    viewer,
  } = input;

  return listing.isPublished
    && listing.tenantId !== viewer.id
    && isProfileVerified(viewer, ProfileKind.CUSTOMER)
    && isProfileVerified(supplier, ProfileKind.SUPPLIER)
    && listingPrice !== undefined
    && listingPrice.tiers.length > 0
    && isPriceListActual(priceList, today);
};
