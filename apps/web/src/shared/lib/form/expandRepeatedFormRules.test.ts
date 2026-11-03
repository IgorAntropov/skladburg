import type { FormRulesValue } from '@skladburg/contracts/forms';
import type { ResolverResult } from 'react-hook-form';

import { validateFormValues } from '@skladburg/contracts/forms';
import {
  PriceTierFormRules,
  SaveListingPriceRequestFormRules,
  WarehouseAvailabilityFormRules,
} from '@skladburg/contracts/forms/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { collectFieldNames } from './collectFieldNames';
import { createContractResolver } from './createContractResolver';
import { expandRepeatedFormRules } from './expandRepeatedFormRules';

interface TierValues {
  minQuantity: string;
  price: { amountMinor: string; currencyCode: string };
}

const createEmptyTier = (): TierValues => ({ minQuantity: '', price: { amountMinor: '', currencyCode: '' } });
const createFilledTier = (): TierValues => ({ minQuantity: '1000', price: { amountMinor: '8950', currencyCode: 'RUB' } });

const expandTiers = (capacity: number): FormRulesValue =>
  expandRepeatedFormRules(SaveListingPriceRequestFormRules, 'tiers', PriceTierFormRules, capacity);

const createDefaults = (tiers: TierValues[]): { tiers: TierValues[] } => ({ tiers });

const toBigIntOrUndefined = (text: string): bigint | undefined => (text === '' ? undefined : BigInt(text));

const toFlatValues = (tiers: TierValues[]): Record<string, unknown> => {
  const values: Record<string, unknown> = {};

  for (const [index, tier] of tiers.entries()) {
    values[`tiers.${String(index)}.minQuantity`] = toBigIntOrUndefined(tier.minQuantity);
    values[`tiers.${String(index)}.price.amountMinor`] = toBigIntOrUndefined(tier.price.amountMinor);
    values[`tiers.${String(index)}.price.currencyCode`] = tier.price.currencyCode;
  }

  return values;
};

const resolveTiers = async (rules: FormRulesValue, tiers: TierValues[]): Promise<ResolverResult<{ tiers: TierValues[] }>> =>
  createContractResolver<{ tiers: TierValues[] }>(rules, collectFieldNames(createDefaults(tiers)))(
    createDefaults(tiers),
    undefined,
    { fields: {}, shouldUseNativeValidation: undefined },
  );

describe('expandRepeatedFormRules', () => {
  it('replaces the rule of the list with the rules of the elements for every row', () => {
    const { fields } = expandTiers(2);

    expect(Object.keys(fields)).not.toContain('tiers');
    expect(Object.keys(fields)).toEqual(expect.arrayContaining([
      'expectedVersion',
      'tiers.0.minQuantity',
      'tiers.0.price.amountMinor',
      'tiers.0.price.currencyCode',
      'tiers.1.minQuantity',
      'tiers.1.price.amountMinor',
      'tiers.1.price.currencyCode',
    ]));
    expect(Object.keys(fields).filter(name => name.startsWith('tiers.'))).toHaveLength(2 * Object.keys(PriceTierFormRules.fields).length);
  });

  it('names the proto path of a row element with its index', () => {
    const { fields } = expandTiers(3);

    expect(fields['tiers.0.minQuantity']?.protoName).toBe('tiers[0].min_quantity');
    expect(fields['tiers.2.price.amountMinor']?.protoName).toBe('tiers[2].price.amount_minor');
  });

  it('keeps the bounds of the element rules', () => {
    const { fields } = expandTiers(1);

    expect(fields['tiers.0.minQuantity']).toMatchObject({ gt: 0n, kind: 'integer', type: 'int64' });
    expect(fields['tiers.0.price.amountMinor']).toMatchObject({ gte: 0n, kind: 'integer' });
  });

  it('expands the warehouses of the availability by the name of the warehouse', () => {
    const rules = expandRepeatedFormRules(
      { fields: { availability: { kind: 'repeated', maxItems: 50, protoName: 'availability' } } },
      'availability',
      WarehouseAvailabilityFormRules,
      2,
    );

    expect(rules.fields['availability.1.warehouseId']?.protoName).toBe('availability[1].warehouse_id');
    expect(rules.fields['availability.1.quantity']).toMatchObject({ gte: 0n, kind: 'integer' });
  });

  it('gives no rows for zero capacity and leaves the source rules as they were', () => {
    const fieldsBefore = { ...SaveListingPriceRequestFormRules.fields };
    const rules = expandTiers(0);

    expect(Object.keys(rules.fields)).not.toContain('tiers');
    expect(Object.keys(rules.fields).some(name => name.startsWith('tiers.'))).toBe(false);
    expect(SaveListingPriceRequestFormRules.fields).toEqual(fieldsBefore);
  });

  it('does not make a field of a row required and keeps the fields that are ignored always', () => {
    const rules = expandRepeatedFormRules(
      { fields: { rows: { kind: 'repeated', protoName: 'rows' } } },
      'rows',
      {
        fields: {
          note: { ignore: 'always', kind: 'string', protoName: 'note' },
          title: { isRequired: true, kind: 'string', protoName: 'title' },
        },
      },
      1,
    );

    expect(rules.fields['rows.0.title']).toMatchObject({ ignore: 'ifZeroValue', isRequired: false });
    expect(rules.fields['rows.0.note']?.ignore).toBe('always');
  });

  describe('validation of the rows', () => {
    const rules = expandTiers(4);

    const validate = (tiers: TierValues[]): { field: string; ruleId: string }[] =>
      validateFormValues(rules, toFlatValues(tiers), collectFieldNames(createDefaults(tiers)));

    it('does not fire on the empty fields of the hidden rows', () => {
      expect(validate([createFilledTier(), createEmptyTier(), createEmptyTier(), createEmptyTier()])).toEqual([]);
    });

    it('fires on a filled row with a value that breaks the rules', () => {
      const issues = validate([
        createFilledTier(),
        { minQuantity: '5000', price: { amountMinor: '-1', currencyCode: 'RUB' } },
        createEmptyTier(),
        createEmptyTier(),
      ]);

      expect(issues).toEqual([{ field: 'tiers.1.price.amountMinor', ruleId: 'int64.gte' }]);
    });

    it('checks the currency code of a filled row', () => {
      const issues = validate([
        { minQuantity: '1000', price: { amountMinor: '8950', currencyCode: 'rub' } },
        createEmptyTier(),
        createEmptyTier(),
        createEmptyTier(),
      ]);

      expect(issues.map(issue => issue.field)).toEqual(['tiers.0.price.currencyCode']);
    });
  });

  describe('contract resolver', () => {
    const rules = expandTiers(3);

    it('lets the form with hidden empty rows through and turns the filled texts into numbers', async () => {
      const result = await resolveTiers(rules, [createFilledTier(), createEmptyTier(), createEmptyTier()]);

      expect(result).toMatchObject({ errors: {} });
      expect(result).toMatchObject({
        values: {
          tiers: [
            { minQuantity: 1000n, price: { amountMinor: 8950n, currencyCode: 'RUB' } },
            { minQuantity: undefined },
            { minQuantity: undefined },
          ],
        },
      });
    });

    it('does not change the values that the form holds', async () => {
      const tiers = [createFilledTier(), createEmptyTier(), createEmptyTier()];

      await resolveTiers(rules, tiers);

      expect(tiers[0]).toEqual({ minQuantity: '1000', price: { amountMinor: '8950', currencyCode: 'RUB' } });
    });

    it('reports a text that is not a number under the row where it is', async () => {
      const result = await resolveTiers(rules, [createFilledTier(), { ...createFilledTier(), minQuantity: 'abc' }, createEmptyTier()]);

      expect(result).toMatchObject({ errors: { tiers: [undefined, { minQuantity: { type: 'integer.invalid' } }] } });
    });
  });
});
