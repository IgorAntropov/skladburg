import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

import { pickBestAvailability } from './pickBestAvailability';

export const pickOfferAvailability = (listing: ShowcaseListing): AvailabilityStatus | undefined => {
  const [cheapestQuote] = listing.quotes;
  const offerCity = cheapestQuote === undefined
    ? undefined
    : listing.cityAvailability.find(item => item.cityId === cheapestQuote.shipFromCityId);

  if (offerCity !== undefined && offerCity.status !== AvailabilityStatus.UNSPECIFIED) {
    return offerCity.status;
  }

  return pickBestAvailability(listing.cityAvailability);
};
