import type {
  ListingPrice,
  PriceTier,
} from '@skladburg/contracts/catalog/v1/catalog';

import { create } from '@bufbuild/protobuf';
import {
  ListingPriceSchema,
  PriceTierSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { summarizeOwnPrice } from './summarizeOwnPrice';

const createTier = (minQuantity: bigint, amountMinor: bigint): PriceTier => create(PriceTierSchema, {
  minQuantity,
  price: create(MoneySchema, { amountMinor, currencyCode: 'RUB' }),
});

const createPrice = (...tiers: PriceTier[]): ListingPrice => create(ListingPriceSchema, { tiers });

describe('summarizeOwnPrice', () => {
  it('has no price before the listing is priced', () => {
    expect(summarizeOwnPrice(undefined)).toEqual({ kind: 'none' });
    expect(summarizeOwnPrice(createPrice())).toEqual({ kind: 'none' });
  });

  it('shows the only price without a lower bound', () => {
    const summary = summarizeOwnPrice(createPrice(createTier(480_000n, 8_900n)));

    expect(summary).toMatchObject({ kind: 'single', price: { amountMinor: 8_900n } });
  });

  it('starts from the lowest tier price', () => {
    const summary = summarizeOwnPrice(createPrice(
      createTier(480_000n, 8_900n),
      createTier(2_000_000n, 8_500n),
      createTier(5_000_000n, 8_700n),
    ));

    expect(summary).toMatchObject({ kind: 'from', price: { amountMinor: 8_500n } });
  });

  it('treats equal tier prices as a single price', () => {
    const summary = summarizeOwnPrice(createPrice(createTier(1n, 8_900n), createTier(2n, 8_900n)));

    expect(summary).toMatchObject({ kind: 'single', price: { amountMinor: 8_900n } });
  });
});
