import type { FormEnumRuleValue } from './formRuleTypes';

export const checkEnumRule = (rule: FormEnumRuleValue, value: number): string[] => {
  const ruleIds: string[] = [];

  if (rule.definedValues !== undefined && !rule.definedValues.includes(value)) {
    ruleIds.push('enum.defined_only');
  }

  if (rule.equalTo !== undefined && value !== rule.equalTo) {
    ruleIds.push('enum.const');
  }

  if (rule.in !== undefined && rule.in.length > 0 && !rule.in.includes(value)) {
    ruleIds.push('enum.in');
  }

  if (rule.notIn?.includes(value) === true) {
    ruleIds.push('enum.not_in');
  }

  return ruleIds;
};
