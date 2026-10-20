import type {
  FormEnumRuleValue,
  FormFieldCommonValue,
  FormFieldIssueValue,
  FormFieldRulesValue,
  FormIntegerRuleValue,
  FormRepeatedRuleValue,
  FormRulesValue,
  FormScalarRuleValue,
  FormStringRuleValue,
} from './formRuleTypes';

import { getFormField } from './getFormField';

interface FieldHandlerValue<TValue> {
  check: (value: TValue) => string[];
  coerce: (raw: unknown) => TValue | undefined;
  isZero: (value: TValue) => boolean;
  zero: TValue;
}

interface IntegerBoundValue {
  bound: IntegerValue;
  kind: 'gt' | 'gte' | 'lt' | 'lte';
}

type IntegerValue = bigint | number;

const compiledPatterns = new Map<string, RegExp | undefined>();

const matchesPattern = (source: string, value: string): boolean => {
  if (!compiledPatterns.has(source)) {
    try {
      compiledPatterns.set(source, new RegExp(source, 'u'));
    }
    catch {
      compiledPatterns.set(source, undefined);
    }
  }

  return compiledPatterns.get(source)?.test(value) ?? true;
};

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;
const LOW_SURROGATE_START = 0xdc00;
const LOW_SURROGATE_END = 0xdfff;

const countCodePoints = (value: string): number => {
  let count = 0;

  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    const nextUnit = value.charCodeAt(index + 1);
    const isSurrogatePair = unit >= HIGH_SURROGATE_START
      && unit <= HIGH_SURROGATE_END
      && nextUnit >= LOW_SURROGATE_START
      && nextUnit <= LOW_SURROGATE_END;

    if (isSurrogatePair) {
      index += 1;
    }

    count += 1;
  }

  return count;
};

const isIntegerValue = (value: unknown): value is IntegerValue =>
  typeof value === 'bigint' || (typeof value === 'number' && Number.isInteger(value));

const isEnumNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

const isComparableElement = (value: unknown): value is IntegerValue | string =>
  typeof value === 'string' || typeof value === 'bigint' || (typeof value === 'number' && !Number.isNaN(value));

const checkString = (rule: FormStringRuleValue, value: string): string[] => {
  const ruleIds: string[] = [];
  const length = countCodePoints(value);

  if (rule.len !== undefined && length !== rule.len) {
    ruleIds.push('string.len');
  }

  if (rule.minLen !== undefined && length < rule.minLen) {
    ruleIds.push('string.min_len');
  }

  if (rule.maxLen !== undefined && length > rule.maxLen) {
    ruleIds.push('string.max_len');
  }

  if (rule.pattern !== undefined && !matchesPattern(rule.pattern, value)) {
    ruleIds.push('string.pattern');
  }

  if (rule.prefix !== undefined && !value.startsWith(rule.prefix)) {
    ruleIds.push('string.prefix');
  }

  if (rule.suffix !== undefined && !value.endsWith(rule.suffix)) {
    ruleIds.push('string.suffix');
  }

  if (rule.contains !== undefined && !value.includes(rule.contains)) {
    ruleIds.push('string.contains');
  }

  if (rule.notContains !== undefined && value.includes(rule.notContains)) {
    ruleIds.push('string.not_contains');
  }

  if (rule.isUuid === true) {
    if (value === '') {
      ruleIds.push('string.uuid_empty');
    }
    else if (!UUID_PATTERN.test(value)) {
      ruleIds.push('string.uuid');
    }
  }

  return ruleIds;
};

const getLowerBound = (rule: FormIntegerRuleValue): IntegerBoundValue | undefined => {
  if (rule.gt !== undefined) {
    return { bound: rule.gt, kind: 'gt' };
  }

  return rule.gte === undefined ? undefined : { bound: rule.gte, kind: 'gte' };
};

const getUpperBound = (rule: FormIntegerRuleValue): IntegerBoundValue | undefined => {
  if (rule.lt !== undefined) {
    return { bound: rule.lt, kind: 'lt' };
  }

  return rule.lte === undefined ? undefined : { bound: rule.lte, kind: 'lte' };
};

const isBelowLower = (value: IntegerValue, lower: IntegerBoundValue): boolean =>
  lower.kind === 'gt' ? value <= lower.bound : value < lower.bound;

const isAboveUpper = (value: IntegerValue, upper: IntegerBoundValue): boolean =>
  upper.kind === 'lt' ? value >= upper.bound : value > upper.bound;

const checkInteger = (rule: FormIntegerRuleValue, value: IntegerValue): string[] => {
  const lower = getLowerBound(rule);
  const upper = getUpperBound(rule);

  if (lower !== undefined && upper !== undefined) {
    const isNormalRange = upper.bound >= lower.bound;
    const isViolated = isNormalRange
      ? isBelowLower(value, lower) || isAboveUpper(value, upper)
      : isBelowLower(value, lower) && isAboveUpper(value, upper);
    const suffix = isNormalRange ? '' : '_exclusive';

    return isViolated ? [`${rule.type}.${lower.kind}_${upper.kind}${suffix}`] : [];
  }

  if (lower !== undefined) {
    return isBelowLower(value, lower) ? [`${rule.type}.${lower.kind}`] : [];
  }

  if (upper !== undefined) {
    return isAboveUpper(value, upper) ? [`${rule.type}.${upper.kind}`] : [];
  }

  return [];
};

const checkEnum = (rule: FormEnumRuleValue, value: number): string[] => {
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

const checkListElement = (rule: FormScalarRuleValue, element: unknown): string[] => {
  switch (rule.kind) {
    case 'enum':
      return isEnumNumber(element) ? checkEnum(rule, element) : [];
    case 'integer':
      return isIntegerValue(element) ? checkInteger(rule, element) : [];
    case 'string':
      return typeof element === 'string' ? checkString(rule, element) : [];
  }
};

const hasDuplicates = (elements: readonly unknown[]): boolean => {
  const comparable = elements.filter(isComparableElement);

  return new Set(comparable).size !== comparable.length;
};

const checkRepeated = (rule: FormRepeatedRuleValue, value: readonly unknown[]): string[] => {
  const ruleIds: string[] = [];

  if (rule.minItems !== undefined && value.length < rule.minItems) {
    ruleIds.push('repeated.min_items');
  }

  if (rule.maxItems !== undefined && value.length > rule.maxItems) {
    ruleIds.push('repeated.max_items');
  }

  if (rule.isUnique === true && hasDuplicates(value)) {
    ruleIds.push('repeated.unique');
  }

  const { items } = rule;

  if (items !== undefined) {
    for (const element of value) {
      ruleIds.push(...checkListElement(items, element));
    }
  }

  return ruleIds;
};

const evaluateField = <TValue>(
  field: FormFieldCommonValue,
  raw: unknown,
  handler: FieldHandlerValue<TValue>,
): string[] => {
  if (field.ignore === 'always') {
    return [];
  }

  const isMissing = raw === undefined || raw === null;
  const value = isMissing ? handler.zero : handler.coerce(raw);

  if (value === undefined) {
    return [];
  }

  const hasPresence = field.hasPresence === true;
  const isPresent = hasPresence ? !isMissing : !handler.isZero(value);

  if (!isPresent && field.isRequired === true) {
    return ['required'];
  }

  if (!isPresent && (hasPresence || field.ignore === 'ifZeroValue')) {
    return [];
  }

  return handler.check(value);
};

const collectFieldRuleIds = (field: FormFieldRulesValue, raw: unknown): string[] => {
  switch (field.kind) {
    case 'enum':
      return evaluateField(field, raw, {
        check: value => checkEnum(field, value),
        coerce: value => (isEnumNumber(value) ? value : undefined),
        isZero: value => value === 0,
        zero: 0,
      });
    case 'integer':
      return evaluateField<IntegerValue>(field, raw, {
        check: value => checkInteger(field, value),
        coerce: value => (isIntegerValue(value) ? value : undefined),
        isZero: value => value === 0 || value === 0n,
        zero: 0,
      });
    case 'opaque':
      return [];
    case 'repeated':
      return evaluateField<readonly unknown[]>(field, raw, {
        check: value => checkRepeated(field, value),
        coerce: value => (Array.isArray(value) ? value : undefined),
        isZero: value => value.length === 0,
        zero: [],
      });
    case 'string':
      return evaluateField(field, raw, {
        check: value => checkString(field, value),
        coerce: value => (typeof value === 'string' ? value : undefined),
        isZero: value => value === '',
        zero: '',
      });
  }
};

export const validateFormValues = (
  rules: FormRulesValue,
  values: Readonly<Record<string, unknown>>,
  fieldNames: readonly string[],
): FormFieldIssueValue[] => {
  const issues: FormFieldIssueValue[] = [];

  for (const name of fieldNames) {
    const field = getFormField(rules, name);

    if (field === undefined || field.isServerOnly === true) {
      continue;
    }

    const raw = Object.hasOwn(values, name) ? values[name] : undefined;

    for (const ruleId of new Set(collectFieldRuleIds(field, raw))) {
      issues.push({ field: name, ruleId });
    }
  }

  return issues;
};
