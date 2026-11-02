import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  MAX_CATALOG_QUANTITY,
  QUANTITY_ABOVE_LIMIT_RULE_ID,
  QUANTITY_BELOW_MINIMUM_RULE_ID,
  QUANTITY_NOT_MULTIPLE_OF_STEP_RULE_ID,
} from '../catalogRules';
import { checkOrderQuantity } from './orderQuantity';

describe('checkOrderQuantity', () => {
  it.each([
    ['equals the minimum order', 10n, 5n, 10n, []],
    ['is a multiple above the minimum', 10n, 5n, 35n, []],
    ['equals the quantity limit', 10n, 5n, MAX_CATALOG_QUANTITY, []],
    ['has no step', 10n, 0n, 13n, []],
    ['is below the minimum order', 10n, 5n, 5n, [QUANTITY_BELOW_MINIMUM_RULE_ID]],
    ['is not a multiple of the step', 10n, 5n, 12n, [QUANTITY_NOT_MULTIPLE_OF_STEP_RULE_ID]],
    ['is below the minimum and not a multiple', 10n, 5n, 7n, [QUANTITY_BELOW_MINIMUM_RULE_ID, QUANTITY_NOT_MULTIPLE_OF_STEP_RULE_ID]],
    ['is one above the quantity limit', 10n, 1n, MAX_CATALOG_QUANTITY + 1n, [QUANTITY_ABOVE_LIMIT_RULE_ID]],
  ])('when the quantity %s', (_name, minOrderQuantity, orderStep, quantity, ruleIds) => {
    const violations = checkOrderQuantity({ minOrderQuantity, orderStep, quantity });

    expect(violations).toEqual(ruleIds.map(ruleId => ({ fieldPath: 'quantity', ruleId })));
  });
});
