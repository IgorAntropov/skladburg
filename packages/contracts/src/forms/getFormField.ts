import type {
  FormFieldRulesValue,
  FormRulesValue,
} from './formRuleTypes';

export const getFormField = (rules: FormRulesValue, field: string): FormFieldRulesValue | undefined =>
  Object.hasOwn(rules.fields, field) ? rules.fields[field] : undefined;
