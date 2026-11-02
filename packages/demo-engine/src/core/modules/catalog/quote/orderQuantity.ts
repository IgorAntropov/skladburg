import type { ViolationValue } from '../../../errors/index';

import {
  collectQuantityLimitViolations,
  QUANTITY_BELOW_MINIMUM_RULE_ID,
  QUANTITY_NOT_MULTIPLE_OF_STEP_RULE_ID,
} from '../catalogRules';

export interface OrderQuantityInputValue {
  minOrderQuantity: bigint;
  orderStep: bigint;
  quantity: bigint;
}

const QUANTITY_FIELD_PATH = 'quantity';

export const checkOrderQuantity = (input: OrderQuantityInputValue): ViolationValue[] => {
  const { minOrderQuantity, orderStep, quantity } = input;
  const violations: ViolationValue[] = [];

  if (quantity < minOrderQuantity) {
    violations.push({ fieldPath: QUANTITY_FIELD_PATH, ruleId: QUANTITY_BELOW_MINIMUM_RULE_ID });
  }

  if (orderStep > 0n && quantity % orderStep !== 0n) {
    violations.push({ fieldPath: QUANTITY_FIELD_PATH, ruleId: QUANTITY_NOT_MULTIPLE_OF_STEP_RULE_ID });
  }

  violations.push(...collectQuantityLimitViolations(quantity, QUANTITY_FIELD_PATH));

  return violations;
};
