import type { FormRulesValue } from '@skladburg/contracts/forms';
import type {
  FieldErrors,
  FieldValues,
  Resolver,
} from 'react-hook-form';

import { validateFormValues } from '@skladburg/contracts/forms';
import { set } from 'react-hook-form';

import {
  coerceFieldValue,
  INVALID_INTEGER_RULE_ID,
} from './coerceFieldValue';

export const createContractResolver = <TValues extends FieldValues>(
  rules: FormRulesValue,
  fieldNames: readonly string[],
): Resolver<TValues> => (values) => {
  const coerced: TValues = { ...values };
  const uncoercibleFields: string[] = [];

  for (const name of fieldNames) {
    if (!Object.hasOwn(rules.fields, name) || !Object.hasOwn(values, name)) {
      continue;
    }

    const field = rules.fields[name];
    const result = field === undefined ? undefined : coerceFieldValue(field, values[name]);

    if (result === undefined) {
      continue;
    }

    if (result.isValid) {
      set(coerced, name, result.value);
    }
    else {
      uncoercibleFields.push(name);
    }
  }

  const issues = [
    ...uncoercibleFields.map(field => ({ field, ruleId: INVALID_INTEGER_RULE_ID })),
    ...validateFormValues(rules, coerced, fieldNames),
  ];

  if (issues.length === 0) {
    return { errors: {}, values: coerced };
  }

  const errors: FieldErrors<TValues> = {};
  const reportedFields = new Set<string>();

  for (const { field, ruleId } of issues) {
    if (!reportedFields.has(field)) {
      reportedFields.add(field);
      set(errors, field, { type: ruleId });
    }
  }

  return { errors, values: {} };
};
