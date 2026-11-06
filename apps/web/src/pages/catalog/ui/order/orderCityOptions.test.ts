import { create } from '@bufbuild/protobuf';
import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import { ShowcaseListingSchema } from '@skladburg/contracts/catalog/v1/showcase';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getOrderCityOptions,
  getOrderDefaults,
} from './orderCityOptions';

const listing = create(ShowcaseListingSchema, {
  cityAvailability: [
    { cityId: 'no-route', quantity: 12n, status: AvailabilityStatus.IN_STOCK },
    { cityId: 'without-name', quantity: 12n, status: AvailabilityStatus.IN_STOCK },
    { cityId: 'unspecified', quantity: 0n, status: AvailabilityStatus.UNSPECIFIED },
    { cityId: 'on-order', quantity: 0n, status: AvailabilityStatus.ON_ORDER },
    { cityId: 'stock', quantity: 12n, status: AvailabilityStatus.IN_STOCK },
  ],
  minOrderQuantity: 8n,
  quotes: [
    { shipFromCityId: 'unspecified', total: { amountMinor: 50n } },
    { shipFromCityId: 'without-name', total: { amountMinor: 60n } },
    { etaDate: { day: 6, month: 11, year: 2026 }, quantity: 10n, shipFromCityId: 'on-order', total: { amountMinor: 70n } },
    { quantity: 10n, shipFromCityId: 'stock', total: { amountMinor: 80n } },
  ],
});

const CITY_NAMES = new Map([
  ['no-route', 'Казань'],
  ['on-order', 'Томск'],
  ['stock', 'Новосибирск'],
  ['unspecified', 'Омск'],
]);

describe('order city options', () => {
  it('keeps named cities with stock or on-order availability and a route, in quote order', () => {
    expect(getOrderCityOptions(listing, CITY_NAMES).map(({ name }) => name)).toEqual(['Томск', 'Новосибирск']);
  });

  it('defaults to the first eligible quote and keeps quantity in base units', () => {
    expect(getOrderDefaults(listing, CITY_NAMES, 'warehouse')).toEqual({
      desiredDate: '2026-11-06',
      quantity: '10',
      shipFromCityId: 'on-order',
      shipToWarehouseId: 'warehouse',
    });
  });

  it('leaves the date and city empty without a usable quote', () => {
    expect(getOrderDefaults(listing, new Map(), 'warehouse')).toEqual({
      desiredDate: '',
      quantity: '8',
      shipFromCityId: '',
      shipToWarehouseId: 'warehouse',
    });
  });
});
