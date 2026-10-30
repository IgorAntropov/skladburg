import {
  describe,
  expect,
  it,
} from 'vitest';

import { getFieldCheckRuleId } from './getFieldCheckRuleId';

describe('getFieldCheckRuleId', () => {
  it.each([
    ['inn', 'field_check.inn'],
    ['kpp', 'field_check.kpp'],
    ['ogrn', 'field_check.ogrn'],
    ['bik', 'field_check.bik'],
    ['settlementAccount', 'field_check.settlement_account'],
    ['correspondentAccount', 'field_check.correspondent_account'],
    ['gtin', 'field_check.gtin'],
  ] as const)('names the rule of %s as %s', (kind, ruleId) => {
    expect(getFieldCheckRuleId(kind)).toBe(ruleId);
  });
});
