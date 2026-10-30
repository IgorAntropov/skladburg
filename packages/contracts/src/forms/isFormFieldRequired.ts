import type {
  FormFieldRulesValue,
  FormRulesValue,
} from './formRuleTypes';

import { checkEnumRule } from './checkEnumRule';
import { checkStringRule } from './checkStringRule';
import { getFormField } from './getFormField';

const isEmptyForbiddenByRules = (field: FormFieldRulesValue): boolean => {
  switch (field.kind) {
    case 'enum':
      return checkEnumRule(field, 0).length > 0;
    case 'integer':
    case 'opaque':
      return false;
    case 'repeated':
      return (field.minItems ?? 0) >= 1;
    case 'string':
      return checkStringRule(field, '').length > 0;
  }
};

export const isFormFieldRequired = (rules: FormRulesValue, field: string): boolean => {
  const fieldRules = getFormField(rules, field);

  if (fieldRules === undefined || fieldRules.ignore === 'always') {
    return false;
  }

  if (fieldRules.hasPresence === true) {
    return fieldRules.isRequired === true;
  }

  if (fieldRules.isRequired === true) {
    return true;
  }

  return fieldRules.ignore === undefined && isEmptyForbiddenByRules(fieldRules);
};
