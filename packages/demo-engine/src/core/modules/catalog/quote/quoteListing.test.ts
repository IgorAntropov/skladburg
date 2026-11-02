import type { PriceTier } from '@skladburg/contracts/catalog/v1/catalog';

import { create } from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  OwnDeliveryTermsSchema,
  PriceTierSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RouteValue } from '../../network/index';
import type { CityAvailabilityValue } from './cityAvailability';
import type { QuoteListingInputValue } from './quoteListing';

import { RU_BUSINESS_CALENDAR } from '../../../calendar/ruBusinessCalendar';
import { quoteListing } from './quoteListing';

const CITY_A = '31000000-0000-4000-8000-000000000001';
const CITY_B = '31000000-0000-4000-8000-000000000002';
const CITY_C = '31000000-0000-4000-8000-000000000003';

const route = (distanceKm: number, driveMinutes: number): RouteValue => ({
  distanceKm,
  driveMinutes,
  legIds: [],
  mapNodeIds: [],
});

const city = (cityId: string, mapNodeId: string): CityAvailabilityValue => ({
  cityId,
  mapNodeId,
  quantity: 1000n,
  status: AvailabilityStatus.IN_STOCK,
});

const tier = (minQuantity: bigint, amountMinor: bigint): PriceTier =>
  create(PriceTierSchema, { minQuantity, price: create(MoneySchema, { amountMinor, currencyCode: 'RUB' }) });

const ownDelivery = create(OwnDeliveryTermsSchema, {
  minimumCharge: create(MoneySchema, { amountMinor: 100_000n, currencyCode: 'RUB' }),
  pricePerKm: create(MoneySchema, { amountMinor: 1200n, currencyCode: 'RUB' }),
});

const MONDAY_NOON_MOSCOW = Date.UTC(2026, 9, 12, 9);

const buildInput = (overrides: Partial<QuoteListingInputValue> = {}): QuoteListingInputValue => ({
  calendar: RU_BUSINESS_CALENDAR,
  cities: [city(CITY_A, 'node-a')],
  ownDelivery,
  preparationWorkingDays: 2,
  priceUnitBaseQuantity: 1000n,
  quantity: 480_000n,
  routes: new Map([['node-a', route(1270, 970)]]),
  tiers: [tier(10_000n, 9500n), tier(480_000n, 8900n)],
  timeZone: 'Europe/Moscow',
  worldTimeMs: MONDAY_NOON_MOSCOW,
  ...overrides,
});

describe('quoteListing', () => {
  it('prices the 480 kilogram pallet of apples from Krasnodar to Moscow', () => {
    const [quote, ...rest] = quoteListing(buildInput());

    expect(rest).toEqual([]);
    expect(quote).toEqual({
      deliveryPriceMinor: 1_524_000n,
      distanceKm: 1270,
      etaDate: { day: 15, month: 10, year: 2026 },
      goodsTotalMinor: 4_272_000n,
      isSupplierDelivery: true,
      quantity: 480_000n,
      shipFromCityId: CITY_A,
      totalMinor: 5_796_000n,
      unitPriceMinor: 8900n,
    });
  });

  it('sorts the cities by the total and breaks a tie by the city id', () => {
    const quotes = quoteListing(buildInput({
      cities: [city(CITY_C, 'node-c'), city(CITY_B, 'node-b'), city(CITY_A, 'node-a')],
      routes: new Map([
        ['node-a', route(1270, 970)],
        ['node-b', route(500, 400)],
        ['node-c', route(500, 420)],
      ]),
    }));

    expect(quotes.map(quote => quote.shipFromCityId)).toEqual([CITY_B, CITY_C, CITY_A]);
    expect(quotes.map(quote => quote.totalMinor)).toEqual([4_872_000n, 4_872_000n, 5_796_000n]);
  });

  it('leaves out a city without a route and uses the route of each city for the distance and the road time', () => {
    const quotes = quoteListing(buildInput({
      cities: [city(CITY_A, 'node-a'), city(CITY_B, 'node-b')],
      routes: new Map([['node-b', route(100, 60)]]),
    }));

    expect(quotes.map(quote => [quote.shipFromCityId, quote.distanceKm, quote.deliveryPriceMinor])).toEqual([[CITY_B, 100, 120_000n]]);
    expect(quoteListing(buildInput({ routes: new Map() }))).toEqual([]);
  });

  it('treats a missing own delivery as a pickup with a free delivery', () => {
    const quotes = quoteListing(buildInput({
      cities: [city(CITY_B, 'node-b'), city(CITY_A, 'node-a')],
      ownDelivery: undefined,
      routes: new Map([['node-a', route(1270, 970)], ['node-b', route(500, 400)]]),
    }));

    expect(quotes.map(quote => quote.isSupplierDelivery)).toEqual([false, false]);
    expect(quotes.map(quote => quote.deliveryPriceMinor)).toEqual([0n, 0n]);
    expect(quotes.map(quote => quote.totalMinor)).toEqual([4_272_000n, 4_272_000n]);
    expect(quotes.map(quote => quote.shipFromCityId)).toEqual([CITY_A, CITY_B]);
  });

  it('applies the tier that matches the quantity', () => {
    const [quote] = quoteListing(buildInput({ quantity: 20_000n }));

    expect(quote).toMatchObject({ goodsTotalMinor: 190_000n, unitPriceMinor: 9500n });
  });

  it('gives an empty list when no tier is reached or the tier has no price', () => {
    expect(quoteListing(buildInput({ quantity: 9_999n }))).toEqual([]);
    expect(quoteListing(buildInput({ tiers: [] }))).toEqual([]);
    expect(quoteListing(buildInput({ tiers: [create(PriceTierSchema, { minQuantity: 1n })] }))).toEqual([]);
  });

  it('keeps a quote with an empty date when the calendar does not cover the world time', () => {
    const [quote] = quoteListing(buildInput({ worldTimeMs: Date.UTC(2028, 2, 1, 9) }));

    expect(quote?.etaDate).toBeUndefined();
    expect(quote?.totalMinor).toBe(5_796_000n);
  });
});
