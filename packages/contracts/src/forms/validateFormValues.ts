import type {
  FieldCheckRunnerValue,
  FormFieldCommonValue,
  FormFieldIssueValue,
  FormFieldRulesValue,
  FormIntegerRuleValue,
  FormRepeatedRuleValue,
  FormRulesValue,
  FormScalarRuleValue,
} from './formRuleTypes';

import { checkEnumRule } from './checkEnumRule';
import { checkStringRule } from './checkStringRule';
import { getFormField } from './getFormField';

export interface ValidateFormValuesOptionsValue {
  runCheck?: FieldCheckRunnerValue | undefined;
}

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

const isIntegerValue = (value: unknown): value is IntegerValue =>
  typeof value === 'bigint' || (typeof value === 'number' && Number.isInteger(value));

const isEnumNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

const isComparableElement = (value: unknown): value is IntegerValue | string =>
  typeof value === 'string' || typeof value === 'bigint' || (typeof value === 'number' && !Number.isNaN(value));

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

const checkListElement = (rule: FormScalarRuleValue, element: unknown): string[] => {
  switch (rule.kind) {
    case 'enum':
      return isEnumNumber(element) ? checkEnumRule(rule, element) : [];
    case 'integer':
      return isIntegerValue(element) ? checkInteger(rule, element) : [];
    case 'string':
      return typeof element === 'string' ? checkStringRule(rule, element) : [];
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
        check: value => checkEnumRule(field, value),
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
        check: value => checkStringRule(field, value),
        coerce: value => (typeof value === 'string' ? value : undefined),
        isZero: value => value === '',
        zero: '',
      });
  }
};

const readValue = (values: Readonly<Record<string, unknown>>, name: string): unknown =>
  Object.hasOwn(values, name) ? values[name] : undefined;

const toText = (raw: unknown): string => (typeof raw === 'string' ? raw : '');

const collectOwnRuleIds = (field: FormFieldRulesValue, raw: unknown): string[] => [
  ...new Set(collectFieldRuleIds(field, raw)),
];

const collectPeerViolationFreeValue = (
  rules: FormRulesValue,
  values: Readonly<Record<string, unknown>>,
  peerName: string,
  runCheck: FieldCheckRunnerValue,
): string | undefined => {
  const peer = getFormField(rules, peerName);
  const peerValue = toText(readValue(values, peerName));

  if (peer === undefined || peerValue === '') {
    return undefined;
  }

  const hasOwnViolations = peer.isServerOnly !== true && collectOwnRuleIds(peer, peerValue).length > 0;

  if (hasOwnViolations) {
    return undefined;
  }

  const hasCheckViolation = peer.check !== undefined && runCheck(peer.check, peerValue, undefined) !== undefined;

  return hasCheckViolation ? undefined : peerValue;
};

const collectCheckRuleId = (
  rules: FormRulesValue,
  values: Readonly<Record<string, unknown>>,
  field: FormFieldRulesValue,
  raw: unknown,
  runCheck: FieldCheckRunnerValue,
): string | undefined => {
  const { check } = field;

  if (check === undefined || field.ignore === 'always' || typeof raw !== 'string') {
    return undefined;
  }

  const peerName = check.peerField;

  if (peerName === undefined) {
    return runCheck(check, raw, undefined);
  }

  const peerValue = collectPeerViolationFreeValue(rules, values, peerName, runCheck);

  return peerValue === undefined ? undefined : runCheck(check, raw, peerValue);
};

const isUnsetValue = (values: Readonly<Record<string, unknown>>, name: string): boolean =>
  Object.hasOwn(values, name) && (values[name] === undefined || values[name] === null);

const hasUnsetAncestor = (
  rules: FormRulesValue,
  values: Readonly<Record<string, unknown>>,
  name: string,
): boolean => {
  let separatorIndex = name.indexOf('.');

  while (separatorIndex !== -1) {
    const ancestor = name.slice(0, separatorIndex);

    if (getFormField(rules, ancestor) !== undefined && isUnsetValue(values, ancestor)) {
      return true;
    }

    separatorIndex = name.indexOf('.', separatorIndex + 1);
  }

  return false;
};

export const validateFormValues = (
  rules: FormRulesValue,
  values: Readonly<Record<string, unknown>>,
  fieldNames: readonly string[],
  options?: ValidateFormValuesOptionsValue,
): FormFieldIssueValue[] => {
  const runCheck = options?.runCheck;
  const issues: FormFieldIssueValue[] = [];

  for (const name of fieldNames) {
    const field = getFormField(rules, name);

    if (field === undefined || field.isServerOnly === true || hasUnsetAncestor(rules, values, name)) {
      continue;
    }

    const raw = readValue(values, name);
    const ruleIds = collectOwnRuleIds(field, raw);

    if (ruleIds.length === 0 && runCheck !== undefined) {
      const checkRuleId = collectCheckRuleId(rules, values, field, raw, runCheck);

      if (checkRuleId !== undefined) {
        ruleIds.push(checkRuleId);
      }
    }

    for (const ruleId of ruleIds) {
      issues.push({ field: name, ruleId });
    }
  }

  return issues;
};
