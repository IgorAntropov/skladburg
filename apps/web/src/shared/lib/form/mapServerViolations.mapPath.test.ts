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

const shiftToThirdRow = (fieldPath: string): string => fieldPath.replace('[0]', '[2]');

describe('mapServerViolations with a path mapper', () => {
  it('places a violation under the field that the mapped path points to', () => {
    const result = mapServerViolations(
      RULES,
      [violation('tiers[0].price.amount_minor', 'int64.gte')],
      FIELD_NAMES,
      shiftToThirdRow,
    );

    expect(result.fieldIssues).toEqual([{ field: 'tiers.2.price.amountMinor', ruleId: 'int64.gte' }]);
    expect(result.unmatched).toEqual([]);
  });

  it('leaves the paths as they are without a mapper', () => {
    const result = mapServerViolations(RULES, [violation('tiers[0].price.amount_minor', 'int64.gte')], FIELD_NAMES);

    expect(result.fieldIssues).toEqual([{ field: 'tiers.0.price.amountMinor', ruleId: 'int64.gte' }]);
  });

  it('keeps the original violation in the remainder when the mapped path points to no field', () => {
    const original = violation('tiers[0]', 'tier.invalid');

    const result = mapServerViolations(RULES, [original], FIELD_NAMES, () => 'tiers[7].price.amount_minor');

    expect(result.fieldIssues).toEqual([]);
    expect(result.unmatched).toEqual([original]);
  });
});
