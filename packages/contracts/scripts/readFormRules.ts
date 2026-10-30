import type {
  DescExtension,
  DescField,
  DescFile,
  DescMessage,
  Message,
} from '@bufbuild/protobuf';
import type {
  EnumRules,
  FieldRules,
  Fixed32Rules,
  Fixed64Rules,
  Int32Rules,
  Int64Rules,
  SFixed32Rules,
  SFixed64Rules,
  SInt32Rules,
  SInt64Rules,
  StringRules,
  UInt32Rules,
  UInt64Rules,
} from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';

import {
  create,
  getOption,
  hasOption,
  isFieldSet,
  ScalarType,
} from '@bufbuild/protobuf';
import { FeatureSet_FieldPresence } from '@bufbuild/protobuf/wkt';
import {
  EnumRulesSchema,
  field as fieldRulesExtension,
  FieldRulesSchema,
  Fixed32RulesSchema,
  Fixed64RulesSchema,
  Ignore,
  Int32RulesSchema,
  Int64RulesSchema,
  message as messageRulesExtension,
  oneof as oneofRulesExtension,
  RepeatedRulesSchema,
  SFixed32RulesSchema,
  SFixed64RulesSchema,
  SInt32RulesSchema,
  SInt64RulesSchema,
  StringRulesSchema,
  UInt32RulesSchema,
  UInt64RulesSchema,
} from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';

import type {
  FormEnumRuleValue,
  FormFieldCheckValue,
  FormFieldCommonValue,
  FormFieldRulesValue,
  FormIgnoreValue,
  FormIntegerRuleValue,
  FormIntegerTypeValue,
  FormRepeatedRuleValue,
  FormRulesValue,
  FormScalarRuleValue,
  FormStringRuleValue,
} from '../src/forms/formRuleTypes.ts';

import { toFieldCheckKind } from '../src/forms/checks/fieldCheckKinds.ts';
import { isPortableRegexPattern } from './isPortableRegexPattern.ts';

export interface MessageFormRulesValue {
  exportName: string;
  rules: FormRulesValue;
}

type ElementValue
  = | { definedValues: number[]; kind: 'enum' }
    | { kind: 'integer'; type: FormIntegerTypeValue }
    | { kind: 'string' };

type IntegerRulesValue
  = | Fixed32Rules
    | Fixed64Rules
    | Int32Rules
    | Int64Rules
    | SFixed32Rules
    | SFixed64Rules
    | SInt32Rules
    | SInt64Rules
    | UInt32Rules
    | UInt64Rules;

type ListField = Extract<DescField, { fieldKind: 'list' }>;

interface ScalarReadValue {
  isServerOnly: boolean;
  rule: FormScalarRuleValue;
}

type TypedRulesValue = FieldRules['type'];

const INTEGER_TYPES = new Map<ScalarType, FormIntegerTypeValue>([
  [ScalarType.FIXED32, 'fixed32'],
  [ScalarType.FIXED64, 'fixed64'],
  [ScalarType.INT32, 'int32'],
  [ScalarType.INT64, 'int64'],
  [ScalarType.SFIXED32, 'sfixed32'],
  [ScalarType.SFIXED64, 'sfixed64'],
  [ScalarType.SINT32, 'sint32'],
  [ScalarType.SINT64, 'sint64'],
  [ScalarType.UINT32, 'uint32'],
  [ScalarType.UINT64, 'uint64'],
]);

const INTEGER_RULE_FIELDS = new Map<FormIntegerTypeValue, readonly DescField[]>([
  ['fixed32', Fixed32RulesSchema.fields],
  ['fixed64', Fixed64RulesSchema.fields],
  ['int32', Int32RulesSchema.fields],
  ['int64', Int64RulesSchema.fields],
  ['sfixed32', SFixed32RulesSchema.fields],
  ['sfixed64', SFixed64RulesSchema.fields],
  ['sint32', SInt32RulesSchema.fields],
  ['sint64', SInt64RulesSchema.fields],
  ['uint32', UInt32RulesSchema.fields],
  ['uint64', UInt64RulesSchema.fields],
]);

const SUPPORTED_STRING_RULES: ReadonlySet<string> = new Set([
  'contains',
  'len',
  'maxLen',
  'minLen',
  'notContains',
  'pattern',
  'prefix',
  'suffix',
  'uuid',
]);

const SUPPORTED_INTEGER_RULES: ReadonlySet<string> = new Set(['gt', 'gte', 'lt', 'lte']);
const SUPPORTED_ENUM_RULES: ReadonlySet<string> = new Set(['const', 'definedOnly', 'in', 'notIn']);
const SUPPORTED_REPEATED_RULES: ReadonlySet<string> = new Set(['items', 'maxItems', 'minItems', 'unique']);
const NON_RULE_FIELDS: ReadonlySet<string> = new Set(['example']);

const hasUnknownFields = (message: Message): boolean => (message.$unknown?.length ?? 0) > 0;

const hasUnsupportedRules = (
  rules: Message,
  fields: readonly DescField[],
  supported: ReadonlySet<string>,
): boolean =>
  hasUnknownFields(rules)
  || fields.some(field =>
    !supported.has(field.localName)
    && !NON_RULE_FIELDS.has(field.localName)
    && isFieldSet(rules, field));

const hasCelRules = (rules: FieldRules): boolean => rules.cel.length > 0 || rules.celExpression.length > 0;

const toSafeCount = (value: bigint): number | undefined =>
  value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : undefined;

const getIntegerRules = (type: TypedRulesValue, integerType: FormIntegerTypeValue): IntegerRulesValue | undefined => {
  switch (type.case) {
    case 'fixed32':
    case 'fixed64':
    case 'int32':
    case 'int64':
    case 'sfixed32':
    case 'sfixed64':
    case 'sint32':
    case 'sint64':
    case 'uint32':
    case 'uint64':
      return type.case === integerType ? type.value : undefined;
    default:
      return undefined;
  }
};

const readStringRule = (rules: StringRules | undefined): ScalarReadValue => {
  const rule: FormStringRuleValue = { kind: 'string' };

  if (rules === undefined) {
    return { isServerOnly: false, rule };
  }

  let isServerOnly = hasUnsupportedRules(rules, StringRulesSchema.fields, SUPPORTED_STRING_RULES);

  const counts: readonly [keyof Pick<FormStringRuleValue, 'len' | 'maxLen' | 'minLen'>, bigint, DescField][] = [
    ['len', rules.len, StringRulesSchema.field.len],
    ['maxLen', rules.maxLen, StringRulesSchema.field.maxLen],
    ['minLen', rules.minLen, StringRulesSchema.field.minLen],
  ];

  for (const [key, value, descriptor] of counts) {
    if (!isFieldSet(rules, descriptor)) {
      continue;
    }

    const count = toSafeCount(value);

    if (count === undefined) {
      isServerOnly = true;
    }
    else {
      rule[key] = count;
    }
  }

  const texts: readonly [keyof Pick<FormStringRuleValue, 'contains' | 'notContains' | 'prefix' | 'suffix'>, string, DescField][] = [
    ['contains', rules.contains, StringRulesSchema.field.contains],
    ['notContains', rules.notContains, StringRulesSchema.field.notContains],
    ['prefix', rules.prefix, StringRulesSchema.field.prefix],
    ['suffix', rules.suffix, StringRulesSchema.field.suffix],
  ];

  for (const [key, value, descriptor] of texts) {
    if (isFieldSet(rules, descriptor)) {
      rule[key] = value;
    }
  }

  if (isFieldSet(rules, StringRulesSchema.field.pattern)) {
    if (isPortableRegexPattern(rules.pattern)) {
      rule.pattern = rules.pattern;
    }
    else {
      isServerOnly = true;
    }
  }

  if (rules.wellKnown.case === 'uuid' && rules.wellKnown.value) {
    rule.isUuid = true;
  }

  return { isServerOnly, rule };
};

const readIntegerRule = (type: FormIntegerTypeValue, rules: IntegerRulesValue | undefined): ScalarReadValue => {
  const rule: FormIntegerRuleValue = { kind: 'integer', type };

  if (rules === undefined) {
    return { isServerOnly: false, rule };
  }

  const isServerOnly = hasUnsupportedRules(rules, INTEGER_RULE_FIELDS.get(type) ?? [], SUPPORTED_INTEGER_RULES);
  const { greaterThan, lessThan } = rules;

  if (lessThan.case === 'lt') {
    rule.lt = lessThan.value;
  }

  if (lessThan.case === 'lte') {
    rule.lte = lessThan.value;
  }

  if (greaterThan.case === 'gt') {
    rule.gt = greaterThan.value;
  }

  if (greaterThan.case === 'gte') {
    rule.gte = greaterThan.value;
  }

  return { isServerOnly, rule };
};

const readEnumRule = (definedValues: number[], rules: EnumRules | undefined): ScalarReadValue => {
  const rule: FormEnumRuleValue = { kind: 'enum' };

  if (rules === undefined) {
    return { isServerOnly: false, rule };
  }

  const isServerOnly = hasUnsupportedRules(rules, EnumRulesSchema.fields, SUPPORTED_ENUM_RULES);

  if (rules.definedOnly) {
    rule.definedValues = definedValues;
  }

  if (isFieldSet(rules, EnumRulesSchema.field.const)) {
    rule.equalTo = rules.const;
  }

  if (rules.in.length > 0) {
    rule.in = [...rules.in];
  }

  if (rules.notIn.length > 0) {
    rule.notIn = [...rules.notIn];
  }

  return { isServerOnly, rule };
};

const getDefinedValues = (values: readonly { number: number }[]): number[] => [...new Set(values.map(value => value.number))];

const describeScalarElement = (scalar: ScalarType): ElementValue | undefined => {
  if (scalar === ScalarType.STRING) {
    return { kind: 'string' };
  }

  const integerType = INTEGER_TYPES.get(scalar);

  return integerType === undefined ? undefined : { kind: 'integer', type: integerType };
};

const describeListElement = (field: ListField): ElementValue | undefined => {
  switch (field.listKind) {
    case 'enum':
      return { definedValues: getDefinedValues(field.enum.values), kind: 'enum' };
    case 'scalar':
      return describeScalarElement(field.scalar);
    default:
      return undefined;
  }
};

const describeElement = (field: DescField): ElementValue | undefined => {
  switch (field.fieldKind) {
    case 'enum':
      return { definedValues: getDefinedValues(field.enum.values), kind: 'enum' };
    case 'list':
      return describeListElement(field);
    case 'scalar':
      return describeScalarElement(field.scalar);
    default:
      return undefined;
  }
};

const readElementRule = (element: ElementValue, type: TypedRulesValue): ScalarReadValue => {
  switch (element.kind) {
    case 'enum':
      return type.case === 'enum'
        ? readEnumRule(element.definedValues, type.value)
        : { isServerOnly: type.case !== undefined, rule: { kind: 'enum' } };
    case 'integer': {
      const result = readIntegerRule(element.type, getIntegerRules(type, element.type));
      const isMismatch = type.case !== undefined && type.case !== element.type;

      return { isServerOnly: result.isServerOnly || isMismatch, rule: result.rule };
    }
    case 'string':
      return type.case === 'string'
        ? readStringRule(type.value)
        : { isServerOnly: type.case !== undefined, rule: { kind: 'string' } };
  }
};

const hasUnsupportedItemRules = (items: FieldRules): boolean =>
  hasCelRules(items)
  || hasUnknownFields(items)
  || items.required
  || items.ignore !== Ignore.UNSPECIFIED;

const readRepeatedRule = (
  field: ListField,
  type: TypedRulesValue,
): { isServerOnly: boolean; rule: FormRepeatedRuleValue } => {
  const rule: FormRepeatedRuleValue = { kind: 'repeated' };
  const element = describeListElement(field);
  let isServerOnly = element === undefined || (type.case !== undefined && type.case !== 'repeated');

  if (type.case !== 'repeated') {
    return { isServerOnly, rule };
  }

  const rules = type.value;

  isServerOnly ||= hasUnsupportedRules(rules, RepeatedRulesSchema.fields, SUPPORTED_REPEATED_RULES);

  const counts: readonly [keyof Pick<FormRepeatedRuleValue, 'maxItems' | 'minItems'>, bigint, DescField][] = [
    ['maxItems', rules.maxItems, RepeatedRulesSchema.field.maxItems],
    ['minItems', rules.minItems, RepeatedRulesSchema.field.minItems],
  ];

  for (const [key, value, descriptor] of counts) {
    if (!isFieldSet(rules, descriptor)) {
      continue;
    }

    const count = toSafeCount(value);

    if (count === undefined) {
      isServerOnly = true;
    }
    else {
      rule[key] = count;
    }
  }

  if (rules.unique) {
    rule.isUnique = true;
  }

  const { items } = rules;

  if (items !== undefined && element !== undefined) {
    isServerOnly ||= hasUnsupportedItemRules(items);

    if (items.type.case !== undefined) {
      const itemsResult = readElementRule(element, items.type);

      rule.items = itemsResult.rule;
      isServerOnly ||= itemsResult.isServerOnly;
    }
  }

  return { isServerOnly, rule };
};

const readIgnore = (fieldRules: FieldRules, isInMessageOneof: boolean): FormIgnoreValue | undefined => {
  if (!isFieldSet(fieldRules, FieldRulesSchema.field.ignore)) {
    return isInMessageOneof ? 'ifZeroValue' : undefined;
  }

  switch (fieldRules.ignore) {
    case Ignore.ALWAYS:
      return 'always';
    case Ignore.IF_ZERO_VALUE:
      return 'ifZeroValue';
    default:
      return undefined;
  }
};

const hasExplicitPresence = (field: DescField): boolean =>
  (field.fieldKind === 'scalar' || field.fieldKind === 'enum')
  && field.presence !== FeatureSet_FieldPresence.IMPLICIT;

const readFieldRule = (
  field: DescField,
  type: TypedRulesValue,
  protoName: string,
): { isServerOnly: boolean; rule: FormFieldRulesValue } => {
  if (field.fieldKind === 'list') {
    const result = readRepeatedRule(field, type);

    return { isServerOnly: result.isServerOnly, rule: { ...result.rule, protoName } };
  }

  const element = describeElement(field);

  if (element === undefined) {
    return { isServerOnly: true, rule: { kind: 'opaque', protoName } };
  }

  const result = readElementRule(element, type);

  return { isServerOnly: result.isServerOnly, rule: { ...result.rule, protoName } };
};

const readFieldCheckKind = (field: DescField, extension: DescExtension): FormFieldCheckValue | undefined => {
  if (extension.fieldKind !== 'enum' || !hasOption(field, extension)) {
    return undefined;
  }

  const value: unknown = getOption(field, extension);
  const enumValueName = extension.enum.values.find(candidate => candidate.number === value)?.name;
  const kind = enumValueName === undefined ? undefined : toFieldCheckKind(enumValueName);

  if (kind === undefined) {
    return undefined;
  }

  const isString = field.fieldKind === 'scalar' && field.scalar === ScalarType.STRING;

  if (!isString) {
    throw new Error(`The field check ${kind} of ${field.parent.typeName}.${field.name} needs a string field`);
  }

  return { kind };
};

const readField = (
  field: DescField,
  isInMessageOneof: boolean,
  protoName: string,
  check: FormFieldCheckValue | undefined,
): FormFieldRulesValue | undefined => {
  const hasRules = hasOption(field, fieldRulesExtension);

  if (!hasRules && check === undefined) {
    return undefined;
  }

  const fieldRules = hasRules ? getOption(field, fieldRulesExtension) : create(FieldRulesSchema);
  const result = readFieldRule(field, fieldRules.type, protoName);
  const common: FormFieldCommonValue = { protoName };
  const ignore = readIgnore(fieldRules, isInMessageOneof);

  if (check !== undefined) {
    common.check = check;
  }

  if (hasExplicitPresence(field)) {
    common.hasPresence = true;
  }

  if (ignore !== undefined) {
    common.ignore = ignore;
  }

  if (fieldRules.required) {
    common.isRequired = true;
  }

  if (result.isServerOnly || hasCelRules(fieldRules) || hasUnknownFields(fieldRules)) {
    common.isServerOnly = true;
  }

  return { ...result.rule, ...common };
};

const hasServerOnlyMessageRules = (message: DescMessage): boolean => {
  const messageRules = getOption(message, messageRulesExtension);
  const hasRequiredOneof = message.oneofs.some(oneof => getOption(oneof, oneofRulesExtension).required);

  return messageRules.cel.length > 0
    || messageRules.celExpression.length > 0
    || messageRules.oneof.length > 0
    || hasUnknownFields(messageRules)
    || hasRequiredOneof;
};

interface MessageReadValue {
  fields: Record<string, FormFieldRulesValue>;
  hasServerOnlyMessageRules: boolean;
}

interface NestingValue {
  ancestors: readonly string[];
  keyPrefix: string;
  protoPrefix: string;
}

const MAX_NESTING_DEPTH = 3;

const resolvePeerFields = (
  message: DescMessage,
  nesting: NestingValue,
  extension: DescExtension,
): Map<string, string> => {
  const peers = new Map<string, string>();
  const bikFields = message.fields.filter(field => readFieldCheckKind(field, extension)?.kind === 'bik');
  const accountFields = message.fields.filter((field) => {
    const kind = readFieldCheckKind(field, extension)?.kind;

    return kind === 'settlementAccount' || kind === 'correspondentAccount';
  });

  if (bikFields.length > 1) {
    throw new Error(`${message.typeName} has ${String(bikFields.length)} fields with the BIK check, an account needs exactly one`);
  }

  const [bikField] = bikFields;

  for (const account of accountFields) {
    if (bikField === undefined) {
      throw new Error(`${message.typeName}.${account.name} has an account check but no field with the BIK check`);
    }

    peers.set(account.name, `${nesting.keyPrefix}${bikField.localName}`);
  }

  return peers;
};

const readMessageFields = (
  message: DescMessage,
  nesting: NestingValue,
  extension: DescExtension,
): MessageReadValue => {
  const messageRules = getOption(message, messageRulesExtension);
  const messageOneofFields = new Set(messageRules.oneof.flatMap(rule => rule.fields));
  const peers = resolvePeerFields(message, nesting, extension);
  const result: MessageReadValue = { fields: {}, hasServerOnlyMessageRules: false };

  for (const field of message.fields) {
    const key = `${nesting.keyPrefix}${field.localName}`;
    const protoName = `${nesting.protoPrefix}${field.name}`;
    const check = readFieldCheckKind(field, extension);
    const peerField = peers.get(field.name);
    const fieldCheck = check === undefined || peerField === undefined ? check : { ...check, peerField };
    const ownRules = readField(field, messageOneofFields.has(field.name), protoName, fieldCheck);

    if (ownRules !== undefined) {
      result.fields[key] = ownRules;
    }

    const isNestable = field.fieldKind === 'message'
      && nesting.ancestors.length <= MAX_NESTING_DEPTH
      && !nesting.ancestors.includes(field.message.typeName);

    if (!isNestable) {
      continue;
    }

    const nested = readMessageFields(
      field.message,
      {
        ancestors: [...nesting.ancestors, field.message.typeName],
        keyPrefix: `${key}.`,
        protoPrefix: `${protoName}.`,
      },
      extension,
    );

    result.hasServerOnlyMessageRules ||= nested.hasServerOnlyMessageRules;

    if (Object.keys(nested.fields).length === 0) {
      continue;
    }

    result.fields[key] ??= { isServerOnly: true, kind: 'opaque', protoName };
    Object.assign(result.fields, nested.fields);
  }

  result.hasServerOnlyMessageRules ||= hasServerOnlyMessageRules(message);

  return result;
};

export const readMessageFormRules = (message: DescMessage, checkExtension: DescExtension): FormRulesValue | undefined => {
  const { fields, hasServerOnlyMessageRules: hasServerOnly } = readMessageFields(
    message,
    {
      ancestors: [message.typeName],
      keyPrefix: '',
      protoPrefix: '',
    },
    checkExtension,
  );

  if (hasServerOnly) {
    return { fields, hasServerOnlyMessageRules: true };
  }

  return Object.keys(fields).length === 0 ? undefined : { fields };
};

const getExportName = (message: DescMessage): string => {
  const { package: packageName } = message.file.proto;
  const localTypeName = packageName === '' ? message.typeName : message.typeName.slice(packageName.length + 1);

  return `${localTypeName.replaceAll('.', '_')}FormRules`;
};

const collectMessages = (messages: readonly DescMessage[]): DescMessage[] =>
  messages.flatMap(message => [message, ...collectMessages(message.nestedMessages)]);

export const readFileFormRules = (file: DescFile, checkExtension: DescExtension): MessageFormRulesValue[] =>
  collectMessages(file.messages).flatMap((message) => {
    const rules = readMessageFormRules(message, checkExtension);

    return rules === undefined ? [] : [{ exportName: getExportName(message), rules }];
  });
