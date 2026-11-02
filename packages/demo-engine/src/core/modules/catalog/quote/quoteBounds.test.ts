import type { Money } from '@skladburg/contracts/common/v1/money';

import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
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

import { RU_BUSINESS_CALENDAR } from '../../../calendar/ruBusinessCalendar';
import {
  MAX_CATALOG_AMOUNT_MINOR,
  MAX_CATALOG_QUANTITY,
} from '../catalogRules';
import { quoteListing } from './quoteListing';

const INT64_MAX = 9_223_372_036_854_775_807n;
const INT32_MAX_KM = 2_147_483_647;

const rub = (amountMinor: bigint): Money => create(MoneySchema, { amountMinor, currencyCode: 'RUB' });

describe('quote bounds', () => {
  it('keeps the worst case total within int64 and encodes it as money', () => {
    const [quote] = quoteListing({
      calendar: RU_BUSINESS_CALENDAR,
      cities: [{ cityId: 'city', mapNodeId: 'node', quantity: MAX_CATALOG_QUANTITY, status: AvailabilityStatus.IN_STOCK }],
      ownDelivery: create(OwnDeliveryTermsSchema, {
        minimumCharge: rub(MAX_CATALOG_AMOUNT_MINOR),
        pricePerKm: rub(MAX_CATALOG_AMOUNT_MINOR),
      }),
      preparationWorkingDays: 0,
      priceUnitBaseQuantity: 1n,
      quantity: MAX_CATALOG_QUANTITY,
      routes: new Map([['node', { distanceKm: INT32_MAX_KM, driveMinutes: 0, legIds: [], mapNodeIds: [] }]]),
      tiers: [create(PriceTierSchema, { minQuantity: 1n, price: rub(MAX_CATALOG_AMOUNT_MINOR) })],
      timeZone: 'Europe/Moscow',
      worldTimeMs: Date.UTC(2026, 9, 12, 9),
    });

    expect(quote?.goodsTotalMinor).toBe(MAX_CATALOG_QUANTITY * MAX_CATALOG_AMOUNT_MINOR);
    expect(quote?.deliveryPriceMinor).toBe(MAX_CATALOG_AMOUNT_MINOR * BigInt(INT32_MAX_KM));
    expect(quote?.totalMinor).toBeLessThanOrEqual(INT64_MAX);
    expect(() => toBinary(MoneySchema, rub(quote?.totalMinor ?? 0n))).not.toThrow();
    expect(() => toBinary(MoneySchema, rub(INT64_MAX + 1n))).toThrow();
  });
});
