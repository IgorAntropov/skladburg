import type { FieldViolation } from '@skladburg/contracts/common/v1/error';

import { create } from '@bufbuild/protobuf';
import { FieldViolationSchema } from '@skladburg/contracts/common/v1/error';
import {
  PriceTierFormRules,
  SaveListingPriceRequestFormRules,
} from '@skladburg/contracts/forms/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { collectFieldNames } from './collectFieldNames';
import { expandRepeatedFormRules } from './expandRepeatedFormRules';
import { mapServerViolations } from './mapServerViolations';

const TIER = { minQuantity: '', price: { amountMinor: '', currencyCode: '' } };

const RULES = expandRepeatedFormRules(SaveListingPriceRequestFormRules, 'tiers', PriceTierFormRules, 3);
const FIELD_NAMES = collectFieldNames({ tiers: [TIER, TIER, TIER] });

const violation = (fieldPath: string, ruleId: string): FieldViolation => create(FieldViolationSchema, { fieldPath, ruleId });

describe('mapServerViolations with rows', () => {
  it('puts a violation of the price of the third row under the price field of the third row', () => {
    const result = mapServerViolations(RULES, [violation('tiers[2].price.amount_minor', 'int64.gte')], FIELD_NAMES);

    expect(result.fieldIssues).toEqual([{ field: 'tiers.2.price.amountMinor', ruleId: 'int64.gte' }]);
    expect(result.unmatched).toEqual([]);
  });

  it('puts a violation of a field in the middle of the path under the same field of its row', () => {
    const result = mapServerViolations(
      RULES,
      [violation('tiers[1].min_quantity', 'int64.gt'), violation('tiers[0].price.amount_minor', 'tier.order')],
      FIELD_NAMES,
    );

    expect(result.fieldIssues).toEqual([
      { field: 'tiers.0.price.amountMinor', ruleId: 'tier.order' },
      { field: 'tiers.1.minQuantity', ruleId: 'int64.gt' },
    ]);
  });

  it('leaves a violation of a row that the form does not have in the remainder', () => {
    const outside = violation('tiers[5].price.amount_minor', 'int64.gte');
    const wholeRow = violation('tiers[1]', 'tier.invalid');

    const result = mapServerViolations(RULES, [outside, wholeRow], FIELD_NAMES);

    expect(result.fieldIssues).toEqual([]);
    expect(result.unmatched).toEqual([outside, wholeRow]);
  });

  it('keeps a violation of a list element under the list field when the form has the list as one field', () => {
    const result = mapServerViolations(
      SaveListingPriceRequestFormRules,
      [violation('tiers[2].price.amount_minor', 'int64.gte')],
      ['tiers'],
    );

    expect(result.fieldIssues).toEqual([{ field: 'tiers', ruleId: 'int64.gte' }]);
  });
});
