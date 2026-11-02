import { create } from '@bufbuild/protobuf';
import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import {
  type CityAvailability,
  CityAvailabilitySchema,
  type DeliveryQuote,
  DeliveryQuoteSchema,
} from '@skladburg/contracts/catalog/v1/showcase';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { buildCityRows } from './buildCityRows';

const CITY_NAMES = new Map([
  ['c-kzn', 'Казань'],
  ['c-msk', 'Москва'],
  ['c-nsk', 'Новосибирск'],
  ['c-spb', 'Санкт-Петербург'],
]);

const availability = (cityId: string): CityAvailability => create(CityAvailabilitySchema, {
  cityId,
  quantity: 100n,
  status: AvailabilityStatus.IN_STOCK,
});

const quote = (shipFromCityId: string): DeliveryQuote => create(DeliveryQuoteSchema, { shipFromCityId });

describe('buildCityRows', () => {
  it('puts the cities with an offer first in the order of the engine and the others by name', () => {
    const rows = buildCityRows(
      {
        cityAvailability: [availability('c-spb'), availability('c-msk'), availability('c-nsk'), availability('c-kzn')],
        quotes: [quote('c-kzn'), quote('c-spb')],
      },
      CITY_NAMES,
    );

    expect(rows.map(row => row.cityName)).toEqual(['Казань', 'Санкт-Петербург', 'Москва', 'Новосибирск']);
    expect(rows.map(row => row.quote !== undefined)).toEqual([true, true, false, false]);
  });

  it('keeps the cheapest offer of a city that has several', () => {
    const first = quote('c-msk');
    const second = quote('c-msk');
    const rows = buildCityRows({ cityAvailability: [availability('c-msk')], quotes: [first, second] }, CITY_NAMES);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.quote).toBe(first);
  });

  it('shows a city of an offer even when it has no availability record', () => {
    const rows = buildCityRows({ cityAvailability: [], quotes: [quote('c-msk')] }, CITY_NAMES);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.cityName).toBe('Москва');
    expect(rows[0]?.availability).toBeUndefined();
    expect(rows[0]?.quote?.shipFromCityId).toBe('c-msk');
  });

  it('returns nothing for a listing without cities', () => {
    expect(buildCityRows({ cityAvailability: [], quotes: [] }, CITY_NAMES)).toEqual([]);
  });
});
