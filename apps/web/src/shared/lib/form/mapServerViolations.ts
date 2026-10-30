import type { FieldViolation } from '@skladburg/contracts/common/v1/error';
import type {
  FormFieldIssueValue,
  FormRulesValue,
} from '@skladburg/contracts/forms';

import { findFormField } from '@skladburg/contracts/forms';

export interface ServerViolationMappingValue {
  fieldIssues: FormFieldIssueValue[];
  unmatched: FieldViolation[];
}

const TRAILING_INDEX_PATTERN = /\[\d+\]$/;
const TRAILING_SEGMENT_PATTERN = /(?:\.[^.[\]]+|\[\d+\])$/;
const SNAKE_SEGMENT_PATTERN = /_([a-z0-9])/g;

const toCamelCasePath = (fieldPath: string): string =>
  fieldPath
    .replace(TRAILING_INDEX_PATTERN, '')
    .replace(SNAKE_SEGMENT_PATTERN, (_match, letter: string) => letter.toUpperCase());

const resolveExactFormField = (
  rules: FormRulesValue,
  fieldPath: string,
  fieldNames: ReadonlySet<string>,
): string | undefined => {
  const ruleField = findFormField(rules, fieldPath);

  if (ruleField !== undefined && fieldNames.has(ruleField)) {
    return ruleField;
  }

  const camelCasePath = toCamelCasePath(fieldPath);

  return fieldNames.has(camelCasePath) ? camelCasePath : undefined;
};

const resolveFormField = (
  rules: FormRulesValue,
  fieldPath: string,
  fieldNames: ReadonlySet<string>,
): string | undefined => {
  const field = resolveExactFormField(rules, fieldPath, fieldNames);

  if (field !== undefined) {
    return field;
  }

  const parentPath = fieldPath.replace(TRAILING_SEGMENT_PATTERN, '');

  return parentPath === fieldPath ? undefined : resolveFormField(rules, parentPath, fieldNames);
};

export const mapServerViolations = (
  rules: FormRulesValue,
  violations: readonly FieldViolation[],
  fieldNames: readonly string[],
): ServerViolationMappingValue => {
  const knownFields = new Set(fieldNames);
  const ruleIdByField = new Map<string, string>();
  const unmatched: FieldViolation[] = [];

  for (const violation of violations) {
    const field = resolveFormField(rules, violation.fieldPath, knownFields);

    if (field === undefined) {
      unmatched.push(violation);
    }
    else if (!ruleIdByField.has(field)) {
      ruleIdByField.set(field, violation.ruleId);
    }
  }

  const fieldIssues: FormFieldIssueValue[] = [];

  for (const field of fieldNames) {
    const ruleId = ruleIdByField.get(field);

    if (ruleId !== undefined) {
      fieldIssues.push({ field, ruleId });
    }
  }

  return { fieldIssues, unmatched };
};
