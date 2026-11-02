import type {
  CityAvailability,
  DeliveryQuote,
  ShowcaseListing,
} from '@skladburg/contracts/catalog/v1/showcase';

import { compareCodeUnits } from '@skladburg/contracts/runtime';

export interface CityRowValue {
  availability: CityAvailability | undefined;
  cityId: string;
  cityName: string;
  quote: DeliveryQuote | undefined;
}

const NAME_COLLATOR = new Intl.Collator('ru');

export const buildCityRows = (
  listing: Pick<ShowcaseListing, 'cityAvailability' | 'quotes'>,
  cityNames: ReadonlyMap<string, string>,
): readonly CityRowValue[] => {
  const availabilityByCity = new Map(listing.cityAvailability.map(item => [item.cityId, item]));
  const quoteByCity = new Map<string, DeliveryQuote>();

  for (const quote of listing.quotes) {
    if (!quoteByCity.has(quote.shipFromCityId)) {
      quoteByCity.set(quote.shipFromCityId, quote);
    }
  }

  const toRow = (cityId: string): CityRowValue => ({
    availability: availabilityByCity.get(cityId),
    cityId,
    cityName: cityNames.get(cityId) ?? '',
    quote: quoteByCity.get(cityId),
  });

  const quotedRows = [...quoteByCity.keys()].map(toRow);
  const unquotedRows = [...availabilityByCity.keys()]
    .filter(cityId => !quoteByCity.has(cityId))
    .map(toRow)
    .toSorted((current, prev) => NAME_COLLATOR.compare(current.cityName, prev.cityName) || compareCodeUnits(current.cityId, prev.cityId));

  return [...quotedRows, ...unquotedRows];
};
