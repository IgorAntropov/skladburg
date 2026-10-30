import type {
  FieldCheckRunnerValue,
  FormRulesValue,
} from '@skladburg/contracts/forms';
import type {
  FieldErrors,
  FieldValues,
  Resolver,
} from 'react-hook-form';

import { validateFormValues } from '@skladburg/contracts/forms';
import {
  get,
  set,
} from 'react-hook-form';

import { cloneFormRecord } from './cloneFormRecord';
import {
  coerceFieldValue,
  INVALID_INTEGER_RULE_ID,
} from './coerceFieldValue';

export interface ContractResolverOptionsValue {
  runCheck?: FieldCheckRunnerValue | undefined;
}

export const createContractResolver = <TInput extends FieldValues, TOutput = TInput>(
  rules: FormRulesValue,
  fieldNames: readonly string[],
  options?: ContractResolverOptionsValue,
): Resolver<TInput, unknown, TOutput> => (values) => {
  const coerced = cloneFormRecord(values);
  const flatValues: Record<string, unknown> = {};
  const uncoercibleFields: string[] = [];

  for (const name of fieldNames) {
    const raw: unknown = get(values, name);
    const field = Object.hasOwn(rules.fields, name) ? rules.fields[name] : undefined;
    const result = field === undefined || raw === undefined ? undefined : coerceFieldValue(field, raw);

    if (result?.isValid === true) {
      set(coerced, name, result.value);
    }
    else if (result !== undefined) {
      uncoercibleFields.push(name);
    }

    flatValues[name] = get(coerced, name);
  }

  const issues = [
    ...uncoercibleFields.map(field => ({ field, ruleId: INVALID_INTEGER_RULE_ID })),
    ...validateFormValues(rules, flatValues, fieldNames, { runCheck: options?.runCheck }),
  ];

  if (issues.length === 0) {
    return { errors: {}, values: coerced as TOutput };
  }

  const errors: FieldErrors<TInput> = {};
  const reportedFields = new Set<string>();

  for (const { field, ruleId } of issues) {
    if (!reportedFields.has(field)) {
      reportedFields.add(field);
      set(errors, field, { type: ruleId });
    }
  }

  return { errors, values: {} };
};
