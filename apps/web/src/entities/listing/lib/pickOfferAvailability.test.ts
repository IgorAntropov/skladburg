import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';

import { create } from '@bufbuild/protobuf';
import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import { ShowcaseListingSchema } from '@skladburg/contracts/catalog/v1/showcase';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { pickOfferAvailability } from './pickOfferAvailability';

const createListing = (
  cities: readonly { cityId: string; status: AvailabilityStatus }[],
  shipFromCityIds: readonly string[],
): ShowcaseListing => create(ShowcaseListingSchema, {
  cityAvailability: cities.map(city => ({ ...city })),
  quotes: shipFromCityIds.map(shipFromCityId => ({ shipFromCityId })),
});

describe('pickOfferAvailability', () => {
  it('takes the status of the city of the cheapest offer, not the best one', () => {
    const listing = createListing(
      [
        { cityId: 'tula', status: AvailabilityStatus.ON_ORDER },
        { cityId: 'ryazan', status: AvailabilityStatus.IN_STOCK },
      ],
      ['tula', 'ryazan'],
    );

    expect(pickOfferAvailability(listing)).toBe(AvailabilityStatus.ON_ORDER);
  });

  it('takes the best status among the cities when there are no offers', () => {
    const listing = createListing(
      [
        { cityId: 'tula', status: AvailabilityStatus.LOW },
        { cityId: 'ryazan', status: AvailabilityStatus.IN_STOCK },
      ],
      [],
    );

    expect(pickOfferAvailability(listing)).toBe(AvailabilityStatus.IN_STOCK);
  });

  it('takes the best status when the offer city has no availability record', () => {
    const listing = createListing([{ cityId: 'ryazan', status: AvailabilityStatus.LOW }], ['tula']);

    expect(pickOfferAvailability(listing)).toBe(AvailabilityStatus.LOW);
  });

  it('takes the best status when the offer city has no status', () => {
    const listing = createListing(
      [
        { cityId: 'tula', status: AvailabilityStatus.UNSPECIFIED },
        { cityId: 'ryazan', status: AvailabilityStatus.ON_ORDER },
      ],
      ['tula'],
    );

    expect(pickOfferAvailability(listing)).toBe(AvailabilityStatus.ON_ORDER);
  });

  it('is undefined without cities and offers', () => {
    expect(pickOfferAvailability(createListing([], []))).toBeUndefined();
  });
});
