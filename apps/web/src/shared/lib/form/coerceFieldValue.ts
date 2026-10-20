import type {
  FormFieldRulesValue,
  FormIntegerTypeValue,
  FormScalarRuleValue,
} from '@skladburg/contracts/forms';

export const INVALID_INTEGER_RULE_ID = 'integer.invalid';

export type CoercedFieldValue
  = | { isValid: false }
    | { isValid: true; value: unknown };

const INTEGER_TEXT_PATTERN = /^[+-]?\d+$/;

const BIG_INTEGER_TYPES: ReadonlySet<FormIntegerTypeValue> = new Set<FormIntegerTypeValue>([
  'fixed64',
  'int64',
  'sfixed64',
  'sint64',
  'uint64',
]);

const INVALID_VALUE: CoercedFieldValue = { isValid: false };

const createValid = (value: unknown): CoercedFieldValue => ({ isValid: true, value });

const parseIntegerText = (text: string, isBig: boolean): CoercedFieldValue => {
  const trimmed = text.trim();

  if (!INTEGER_TEXT_PATTERN.test(trimmed)) {
    return INVALID_VALUE;
  }

  if (isBig) {
    return createValid(BigInt(trimmed));
  }

  const parsed = Number(trimmed);

  return Number.isSafeInteger(parsed) ? createValid(parsed) : INVALID_VALUE;
};

const isBigRule = (rule: FormScalarRuleValue): boolean => rule.kind === 'integer' && BIG_INTEGER_TYPES.has(rule.type);

const coerceScalar = (rule: FormScalarRuleValue, raw: unknown, isEmptyAllowed: boolean): CoercedFieldValue => {
  if (rule.kind === 'string' || typeof raw !== 'string') {
    return createValid(raw);
  }

  if (raw.trim() === '') {
    return isEmptyAllowed ? createValid(undefined) : INVALID_VALUE;
  }

  return parseIntegerText(raw, isBigRule(rule));
};

const coerceList = (items: FormScalarRuleValue, raw: unknown): CoercedFieldValue => {
  if (!Array.isArray(raw)) {
    return createValid(raw);
  }

  const list: readonly unknown[] = raw;
  const elements: unknown[] = [];

  for (const element of list) {
    const coerced = coerceScalar(items, element, false);

    if (!coerced.isValid) {
      return INVALID_VALUE;
    }

    elements.push(coerced.value);
  }

  return createValid(elements);
};

export const coerceFieldValue = (field: FormFieldRulesValue, raw: unknown): CoercedFieldValue => {
  switch (field.kind) {
    case 'enum':
    case 'integer':
      return coerceScalar(field, raw, true);
    case 'opaque':
      return createValid(raw);
    case 'repeated':
      return field.items === undefined ? createValid(raw) : coerceList(field.items, raw);
    case 'string':
      return createValid(raw === '' && field.hasPresence === true ? undefined : raw);
  }
};
