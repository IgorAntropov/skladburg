import type { FormRulesValue } from './formRuleTypes';

const FIELD_PATH_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)(\[\d+\])?$/;

export const findFormField = (rules: FormRulesValue, fieldPath: string): string | undefined => {
  const match = FIELD_PATH_PATTERN.exec(fieldPath);
  const protoName = match?.[1];

  if (protoName === undefined) {
    return undefined;
  }

  const isIndexed = match?.[2] !== undefined;

  for (const [field, fieldRules] of Object.entries(rules.fields)) {
    if (fieldRules.protoName !== protoName) {
      continue;
    }

    return isIndexed && fieldRules.kind !== 'repeated' ? undefined : field;
  }

  return undefined;
};
