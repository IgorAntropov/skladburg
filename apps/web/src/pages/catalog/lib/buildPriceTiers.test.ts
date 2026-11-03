import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  PriceFormOutputValue,
  TierRowOutputValue,
  TierRowValue,
} from './listingFormValues';

import {
  buildTiers,
  collectTierIssues,
  removeTierRow,
} from './buildPriceTiers';
import { TIER_CAPACITY } from './listingFormValues';

const RUB = 'RUB';

const filled = (minQuantity: bigint, amountMinor: bigint): TierRowOutputValue => ({
  minQuantity,
  price: { amountMinor, currencyCode: RUB },
});

const empty = (): TierRowOutputValue => ({ price: { currencyCode: RUB } });

const toValues = (rows: TierRowOutputValue[]): PriceFormOutputValue => ({
  tiers: Array.from({ length: TIER_CAPACITY }, (_item, index) => rows[index] ?? empty()),
});

const toRow = (minQuantity: string, amountMinor: string): TierRowValue => ({
  minQuantity,
  price: { amountMinor, currencyCode: RUB },
});

describe('price tiers of the command', () => {
  it('sends the filled rows in the units of the contract and drops the empty rows at the end', () => {
    const values = toValues([filled(1000n, 8950n), filled(10000n, 8000n)]);

    expect(collectTierIssues(values, 4)).toEqual([]);
    expect(buildTiers(values, 4)).toEqual([
      { minQuantity: 1000n, price: { amountMinor: 8950n, currencyCode: RUB } },
      { minQuantity: 10000n, price: { amountMinor: 8000n, currencyCode: RUB } },
    ]);
  });

  it('does not look at the rows that are not shown', () => {
    const values = toValues([filled(1000n, 8950n), empty(), empty(), filled(5000n, 100n)]);

    expect(buildTiers(values, 2)).toEqual([{ minQuantity: 1000n, price: { amountMinor: 8950n, currencyCode: RUB } }]);
  });

  it('marks both fields of an empty row in the middle', () => {
    const values = toValues([filled(1000n, 8950n), empty(), filled(5000n, 7000n)]);

    expect(collectTierIssues(values, 3)).toEqual([
      { field: 'tiers.1.minQuantity', ruleId: 'required' },
      { field: 'tiers.1.price.amountMinor', ruleId: 'required' },
    ]);
  });

  it('marks only the missing field of a partly filled row', () => {
    const values = toValues([filled(1000n, 8950n), { minQuantity: 5000n, price: { currencyCode: RUB } }]);

    expect(collectTierIssues(values, 2)).toEqual([{ field: 'tiers.1.price.amountMinor', ruleId: 'required' }]);
  });

  it('marks the first row when nothing is filled', () => {
    expect(collectTierIssues(toValues([]), 1)).toEqual([
      { field: 'tiers.0.minQuantity', ruleId: 'required' },
      { field: 'tiers.0.price.amountMinor', ruleId: 'required' },
    ]);
  });

  it('marks a zero minimal quantity that the rows of the contract let through', () => {
    const values = toValues([filled(0n, 8950n)]);

    expect(collectTierIssues(values, 1)).toEqual([{ field: 'tiers.0.minQuantity', ruleId: 'int64.gt' }]);
  });

  it('accepts a zero price, which the contract allows', () => {
    const values = toValues([filled(1000n, 0n)]);

    expect(collectTierIssues(values, 1)).toEqual([]);
    expect(buildTiers(values, 1)).toEqual([{ minQuantity: 1000n, price: { amountMinor: 0n, currencyCode: RUB } }]);
  });
});

const padRows = (rows: TierRowValue[]): TierRowValue[] => Array.from(
  { length: TIER_CAPACITY },
  (_item, index) => rows[index] ?? toRow('', ''),
);

describe('removing a row of tiers', () => {
  it('moves the next rows up, clears the last one and keeps the number of rows', () => {
    const rows = padRows([toRow('1000', '9000'), toRow('2000', '8000'), toRow('3000', '7000')]);

    expect(removeTierRow(rows, 1)).toEqual(padRows([toRow('1000', '9000'), toRow('3000', '7000')]));
  });

  it('clears the row when the last shown row is removed', () => {
    const rows = padRows([toRow('1000', '9000'), toRow('2000', '8000')]);

    expect(removeTierRow(rows, 1)).toEqual(padRows([toRow('1000', '9000')]));
  });
});
