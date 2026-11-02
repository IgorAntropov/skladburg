import type {
  OwnDeliveryTerms,
  PriceTier,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { Money } from '@skladburg/contracts/common/v1/money';

import { create } from '@bufbuild/protobuf';
import {
  OwnDeliveryTermsSchema,
  PriceTierSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  computeDeliveryPrice,
  computeGoodsTotal,
  resolveTier,
} from './tierPricing';

const rub = (amountMinor: bigint): Money =>
  create(MoneySchema, { amountMinor, currencyCode: 'RUB' });

const tier = (minQuantity: bigint, amountMinor: bigint): PriceTier =>
  create(PriceTierSchema, { minQuantity, price: rub(amountMinor) });

const delivery = (pricePerKmMinor: bigint, minimumChargeMinor: bigint): OwnDeliveryTerms =>
  create(OwnDeliveryTermsSchema, { minimumCharge: rub(minimumChargeMinor), pricePerKm: rub(pricePerKmMinor) });

describe('resolveTier', () => {
  const tiers = [tier(10n, 9000n), tier(100n, 8500n), tier(500n, 8000n)];

  it.each([
    ['below the first tier', 9n, undefined],
    ['exactly on the first threshold', 10n, 9000n],
    ['between thresholds', 99n, 9000n],
    ['exactly on a middle threshold', 100n, 8500n],
    ['between the last two thresholds', 499n, 8500n],
    ['exactly on the last threshold', 500n, 8000n],
    ['above the last tier', 100_000n, 8000n],
  ])('picks the tier for a quantity %s', (_name, quantity, expectedAmount) => {
    expect(resolveTier(tiers, quantity)?.price?.amountMinor).toBe(expectedAmount);
  });

  it('finds the highest reached threshold regardless of the array order', () => {
    expect(resolveTier([tier(500n, 8000n), tier(10n, 9000n), tier(100n, 8500n)], 150n)?.price?.amountMinor).toBe(8500n);
  });

  it('returns nothing for an empty list', () => {
    expect(resolveTier([], 10n)).toBeUndefined();
  });
});

describe('computeGoodsTotal', () => {
  it.each([
    ['89 roubles per kilogram priced per 1000 grams for 480 000 grams', 480_000n, 8900n, 1000n, 4_272_000n],
    ['a coefficient of one', 10n, 9000n, 1n, 90_000n],
    ['exactly half a kopeck rounds up', 1n, 1n, 2n, 1n],
    ['one and a half kopecks round up', 3n, 1n, 2n, 2n],
    ['less than half a kopeck rounds down', 499n, 1n, 1000n, 0n],
    ['exactly half a kopeck on a large coefficient rounds up', 500n, 1n, 1000n, 1n],
    ['a third of a kopeck rounds down', 1n, 1n, 3n, 0n],
    ['two thirds of a kopeck round up', 2n, 1n, 3n, 1n],
    ['zero quantity', 0n, 8900n, 1000n, 0n],
  ])('totals %s', (_name, quantity, unitPriceMinor, priceUnitBaseQuantity, expected) => {
    expect(computeGoodsTotal(quantity, unitPriceMinor, priceUnitBaseQuantity)).toBe(expected);
  });
});

describe('computeDeliveryPrice', () => {
  it.each([
    ['there is no own delivery', undefined, 1270, 0n],
    ['the minimum charge beats the tariff', delivery(1200n, 2_000_000n), 1270, 2_000_000n],
    ['the tariff beats the minimum charge', delivery(1200n, 150_000n), 1270, 1_524_000n],
    ['the distance is zero', delivery(1200n, 150_000n), 0, 150_000n],
    ['the tariff equals the minimum charge', delivery(1200n, 1_200_000n), 1000, 1_200_000n],
    ['Krasnodar to Moscow at 12 roubles per kilometre', delivery(1200n, 100_000n), 1270, 1_524_000n],
  ])('prices the delivery when %s', (_name, ownDelivery, distanceKm, expected) => {
    expect(computeDeliveryPrice(ownDelivery, distanceKm)).toBe(expected);
  });
});
