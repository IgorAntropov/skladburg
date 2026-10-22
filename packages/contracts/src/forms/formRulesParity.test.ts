import type {
  DescField,
  DescFile,
  DescMessage,
} from '@bufbuild/protobuf';

import {
  hasOption,
  ScalarType,
} from '@bufbuild/protobuf';
import { reflect } from '@bufbuild/protobuf/reflect';
import {
  field as fieldRulesExtension,
  message as messageRulesExtension,
  oneof as oneofRulesExtension,
} from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';
import { join } from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  FormFieldRulesValue,
  FormIntegerRuleValue,
  FormIntegerTypeValue,
  FormRulesValue,
  FormScalarRuleValue,
  FormStringRuleValue,
} from './formRuleTypes';

import { getContractRegistry } from '../registry/contractRegistry';
import { collectViolations } from '../validation/collectViolations';
import { findFormField } from './findFormField';
import { validateFormValues } from './validateFormValues';

type CaseValue = Readonly<Record<string, unknown>>;

interface IntegerRangeValue {
  isWide: boolean;
  max: bigint;
  min: bigint;
}

interface PatternSamplesValue {
  matching: readonly string[];
  nonMatching: readonly string[];
}

interface RuleMessageValue {
  exportName: string;
  file: DescFile;
  message: DescMessage;
}

const EXTERNAL_FILE_PREFIXES: readonly string[] = ['buf/validate/', 'google/'];

const EXPECTED_SERVER_ONLY_FIELDS: readonly string[] = [
  'access.v1.SetMyAvatarRequest.image',
  'access.v1.SetMyAvatarRequest.mediaType',
];
const EXPECTED_SERVER_ONLY_MESSAGES: readonly string[] = ['common.v1.MethodAccess'];

const VALID_UUID = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const OTHER_UUID = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';

const FILLERS: readonly string[] = ['a', 'ж', '😀'];

const GENERIC_STRINGS: readonly string[] = [
  '',
  'a',
  ' ',
  'ж',
  '😀',
  'абв',
  '😀😀',
  'text\n',
  '\n',
  'Склад Северный',
  VALID_UUID,
  OTHER_UUID,
  VALID_UUID.toUpperCase(),
  `${VALID_UUID}\n`,
  `\n${VALID_UUID}`,
  ` ${VALID_UUID}`,
  `${VALID_UUID} `,
  VALID_UUID.replaceAll('-', ''),
  `{${VALID_UUID}}`,
  VALID_UUID.slice(0, -1),
  `${VALID_UUID}0`,
  VALID_UUID.replace('3f2b', 'zf2b'),
  '00000000-0000-0000-0000-000000000000',
  'city',
  'garbage-value',
];

const PATTERN_SAMPLES: Readonly<Record<string, PatternSamplesValue>> = {
  '^([a-z][a-z0-9_]*)?$': {
    matching: ['', 'a', 'abc', 'a1', 'a_b', 'a_1_b', 'deal_id', 'a__'],
    nonMatching: ['A', '1a', '_a', 'a-b', 'a b', 'a\n', '\n', 'Ab', 'я', 'a.b', ' a', 'a '],
  },
  '^[a-z][a-z0-9]*(_[a-z0-9]+)*_(view|create|edit|delete|approve|sign|fund|release|export|manage)$': {
    matching: [
      'deal_view',
      'deal_create',
      'deal_edit',
      'deal_delete',
      'deal_approve',
      'deal_sign',
      'deal_fund',
      'deal_release',
      'deal_export',
      'deal_manage',
      'warehouse_item_edit',
      'a1_b2_c3_view',
      'a_manage',
    ],
    nonMatching: [
      '',
      'view',
      '_view',
      'deal_',
      'deal_unknown',
      'deal_views',
      'Deal_view',
      'deal_VIEW',
      'deal__view',
      'deal_view_',
      'deal_view\n',
      '\ndeal_view',
      ' deal_view',
      'dealview',
      '1deal_view',
      'deal-view',
      'сделка_view',
      'deal_view_edit_',
    ],
  },
  '^[A-Z]{3}$': {
    matching: ['RUB', 'USD', 'EUR', 'ABC'],
    nonMatching: ['', 'rub', 'RU', 'RUBL', 'RUB\n', '\nRUB', ' RUB', 'RUB ', 'РУБ', 'R1B', 'Rub', 'ЯЯЯ'],
  },
  '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$': {
    matching: [
      'Europe/Moscow',
      'America/Argentina/Buenos_Aires',
      'Etc/GMT+3',
      'Etc/GMT-12',
      'Asia/Ho_Chi_Minh',
      'UTC/a',
      '_/_',
    ],
    nonMatching: [
      '',
      'Moscow',
      'Europe/',
      '/Moscow',
      'Europe//Moscow',
      'Europe/Moscow\n',
      'Europe/Moscow\r',
      ' Europe/Moscow',
      'Europe/Moscow ',
      'Europe/Mos cow',
      'Europe/Mos.cow',
      'Europe1/Moscow',
      'Европа/Москва',
      'Europe/Москва',
    ],
  },
};

const INTEGER_RANGES: Readonly<Record<FormIntegerTypeValue, IntegerRangeValue>> = {
  fixed32: { isWide: false, max: 2n ** 32n - 1n, min: 0n },
  fixed64: { isWide: true, max: 2n ** 64n - 1n, min: 0n },
  int32: { isWide: false, max: 2n ** 31n - 1n, min: -(2n ** 31n) },
  int64: { isWide: true, max: 2n ** 63n - 1n, min: -(2n ** 63n) },
  sfixed32: { isWide: false, max: 2n ** 31n - 1n, min: -(2n ** 31n) },
  sfixed64: { isWide: true, max: 2n ** 63n - 1n, min: -(2n ** 63n) },
  sint32: { isWide: false, max: 2n ** 31n - 1n, min: -(2n ** 31n) },
  sint64: { isWide: true, max: 2n ** 63n - 1n, min: -(2n ** 63n) },
  uint32: { isWide: false, max: 2n ** 32n - 1n, min: 0n },
  uint64: { isWide: true, max: 2n ** 64n - 1n, min: 0n },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFormRules = (value: unknown): value is FormRulesValue =>
  isRecord(value) && isRecord(value.fields);

const hasContractRules = (message: DescMessage): boolean =>
  message.fields.some(field => hasOption(field, fieldRulesExtension))
  || message.oneofs.some(oneof => hasOption(oneof, oneofRulesExtension))
  || hasOption(message, messageRulesExtension);

const collectMessages = (messages: readonly DescMessage[]): DescMessage[] =>
  messages.flatMap(message => [message, ...collectMessages(message.nestedMessages)]);

const getExportName = (message: DescMessage): string => {
  const { package: packageName } = message.file.proto;
  const localTypeName = packageName === '' ? message.typeName : message.typeName.slice(packageName.length + 1);

  return `${localTypeName.replaceAll('.', '_')}FormRules`;
};

const getRuleMessages = (): RuleMessageValue[] =>
  [...getContractRegistry().files]
    .filter(file => !EXTERNAL_FILE_PREFIXES.some(prefix => file.name.startsWith(prefix)))
    .flatMap(file =>
      collectMessages(file.messages)
        .filter(hasContractRules)
        .map(message => ({ exportName: getExportName(message), file, message })));

const GENERATED_FORMS_DIRECTORY = join(import.meta.dirname, '..', 'gen', 'forms');

const importTables = async (fileName: string): Promise<unknown> => {
  const modulePath = join(GENERATED_FORMS_DIRECTORY, `${fileName.replace(/\.proto$/, '')}_rules.ts`);

  return import(modulePath);
};

const loadTable = async (item: RuleMessageValue): Promise<FormRulesValue | undefined> => {
  const loaded = await importTables(item.file.name);

  if (!isRecord(loaded)) {
    return undefined;
  }

  const table = loaded[item.exportName];

  return isFormRules(table) ? table : undefined;
};

const repeatText = (filler: string, length: number): string => filler.repeat(Math.max(0, length));

const around = (borders: readonly (number | undefined)[]): number[] =>
  borders.flatMap(border => (border === undefined ? [] : [border - 1, border, border + 1])).filter(length => length >= 0);

const buildStringCorpus = (rule: FormStringRuleValue): string[] => {
  const lengths = around([rule.minLen, rule.maxLen, rule.len]);
  const samples = new Set<string>(GENERIC_STRINGS);

  for (const length of [0, 1, 2, ...lengths]) {
    for (const filler of FILLERS) {
      samples.add(repeatText(filler, length));
    }
  }

  const { contains, notContains, pattern, prefix, suffix } = rule;

  for (const text of [contains, notContains, prefix, suffix]) {
    if (text !== undefined) {
      samples.add(text);
      samples.add(`x${text}`);
      samples.add(`${text}x`);
      samples.add(`x${text}x`);
    }
  }

  if (pattern !== undefined) {
    const patternSamples = PATTERN_SAMPLES[pattern];

    if (patternSamples === undefined) {
      throw new Error(`No pattern samples for ${pattern}; add matching and non-matching strings to PATTERN_SAMPLES`);
    }

    for (const sample of [...patternSamples.matching, ...patternSamples.nonMatching]) {
      samples.add(sample);
    }
  }

  return [...samples];
};

const buildIntegerCorpus = (rule: FormIntegerRuleValue): (bigint | number)[] => {
  const range = INTEGER_RANGES[rule.type];
  const bounds = [rule.gt, rule.gte, rule.lt, rule.lte].flatMap(bound => (bound === undefined ? [] : [BigInt(bound)]));
  const candidates = new Set<bigint>([
    -1n,
    0n,
    1n,
    2n,
    2n ** 31n,
    2n ** 31n - 1n,
    2n ** 32n - 1n,
    2n ** 53n,
    100n,
    -(2n ** 31n),
    range.max,
    range.max - 1n,
    range.min,
    range.min + 1n,
    ...bounds.flatMap(bound => [bound - 1n, bound, bound + 1n]),
  ]);

  return [...candidates]
    .filter(candidate => candidate >= range.min && candidate <= range.max)
    .map(candidate => (range.isWide ? candidate : Number(candidate)));
};

const buildEnumCorpus = (definedValues: readonly number[], rule: Extract<FormScalarRuleValue, { kind: 'enum' }>): number[] => {
  const highest = Math.max(0, ...definedValues, ...(rule.in ?? []), ...(rule.notIn ?? []));
  const candidates = new Set<number>([
    ...definedValues,
    ...(rule.in ?? []),
    ...(rule.notIn ?? []),
    -1,
    0,
    2 ** 31 - 1,
    9999,
    highest + 1,
    highest + 2,
    rule.equalTo ?? 0,
  ]);

  return [...candidates];
};

const buildScalarCorpus = (rule: FormScalarRuleValue, definedValues: readonly number[]): unknown[] => {
  switch (rule.kind) {
    case 'enum':
      return buildEnumCorpus(definedValues, rule);
    case 'integer':
      return buildIntegerCorpus(rule);
    case 'string':
      return buildStringCorpus(rule);
  }
};

const distinctElement = (rule: FormScalarRuleValue, definedValues: readonly number[], index: number): unknown => {
  switch (rule.kind) {
    case 'enum':
      return definedValues[index % Math.max(1, definedValues.length)] ?? 0;
    case 'integer':
      return INTEGER_RANGES[rule.type].isWide ? BigInt(index) : index;
    case 'string':
      return `item-${String(index)}`;
  }
};

const buildListCorpus = (
  rule: Extract<FormFieldRulesValue, { kind: 'repeated' }>,
  elementRule: FormScalarRuleValue,
  definedValues: readonly number[],
): unknown[][] => {
  const elements = buildScalarCorpus(elementRule, definedValues);
  const lists: unknown[][] = [[]];

  for (const element of elements) {
    lists.push([element], [element, element]);
  }

  const first = elements[0];
  const last = elements.at(-1);

  lists.push(elements.slice(0, 5), [...elements.slice(0, 3), ...elements.slice(0, 3)]);

  if (first !== undefined && last !== undefined) {
    lists.push([first, last, first, last]);
  }

  for (const length of around([rule.minItems, rule.maxItems])) {
    lists.push(Array.from({ length }, (_, index) => distinctElement(elementRule, definedValues, index)));
  }

  return lists;
};

const getDefinedValues = (field: DescField): number[] => {
  if (field.fieldKind === 'enum') {
    return field.enum.values.map(value => value.number);
  }

  if (field.fieldKind === 'list' && field.listKind === 'enum') {
    return field.enum.values.map(value => value.number);
  }

  return [];
};

const getElementRule = (rule: Extract<FormFieldRulesValue, { kind: 'repeated' }>, field: DescField): FormScalarRuleValue => {
  if (rule.items !== undefined) {
    return rule.items;
  }

  if (field.fieldKind === 'list' && field.listKind === 'enum') {
    return { kind: 'enum' };
  }

  if (field.fieldKind === 'list' && field.listKind === 'scalar' && field.scalar === ScalarType.STRING) {
    return { kind: 'string' };
  }

  return { kind: 'integer', type: 'int32' };
};

const buildFieldCorpus = (rule: FormFieldRulesValue, field: DescField): CaseValue[] => {
  const name = field.localName;
  const definedValues = getDefinedValues(field);
  const values = ((): unknown[] => {
    switch (rule.kind) {
      case 'opaque':
        return [];
      case 'repeated':
        return buildListCorpus(rule, getElementRule(rule, field), definedValues);
      default:
        return buildScalarCorpus(rule, definedValues);
    }
  })();

  return [{}, ...values.map(value => ({ [name]: value }))];
};

const setFieldValue = (reflected: ReturnType<typeof reflect>, field: DescField, value: unknown): void => {
  if (field.fieldKind !== 'list') {
    reflected.set(field, value);
    return;
  }

  const list = reflected.get(field);

  if (!Array.isArray(value)) {
    throw new TypeError('Expected a list value');
  }

  for (const element of value) {
    list.add(element);
  }
};

const buildMessageWithValue = (message: DescMessage, field: DescField, values: CaseValue): ReturnType<typeof reflect> | undefined => {
  const reflected = reflect(message);

  if (Object.hasOwn(values, field.localName)) {
    try {
      setFieldValue(reflected, field, values[field.localName]);
    }
    catch {
      return undefined;
    }
  }

  return reflected;
};

const sortedUnique = (ruleIds: readonly string[]): string[] => [...new Set(ruleIds)].toSorted();

interface ComparisonValue {
  compared: number;
  skipped: number;
}

const compareField = (
  item: RuleMessageValue,
  rules: FormRulesValue,
  field: DescField,
  corpus: readonly CaseValue[],
): ComparisonValue => {
  const result: ComparisonValue = { compared: 0, skipped: 0 };

  for (const values of corpus) {
    const reflected = buildMessageWithValue(item.message, field, values);

    if (reflected === undefined) {
      result.skipped += 1;
      continue;
    }

    const violations = collectViolations(item.message, reflected.message);
    const unresolvedPaths = violations
      .filter(violation => violation.fieldPath !== '')
      .filter(violation => findFormField(rules, violation.fieldPath) === undefined)
      .map(violation => violation.fieldPath);
    const expected = sortedUnique(
      violations
        .filter(violation => findFormField(rules, violation.fieldPath) === field.localName)
        .map(violation => violation.ruleId),
    );
    const actual = sortedUnique(
      validateFormValues(rules, values, [field.localName]).map(issue => issue.ruleId),
    );

    expect({ actual, unresolvedPaths, values }).toEqual({ actual: expected, unresolvedPaths: [], values });
    result.compared += 1;
  }

  return result;
};

const ruleMessages = getRuleMessages();
const typeName = (item: RuleMessageValue): string => item.message.typeName;

describe('form rules parity with protovalidate', () => {
  it('finds the messages with rules in the contract image', () => {
    expect(ruleMessages.map(typeName)).toEqual(expect.arrayContaining([
      'common.v1.MethodAccess',
      'common.v1.Money',
      'common.v1.PageRequest',
      'organization.v1.CreateWarehouseRequest',
    ]));
  });

  describe.each(ruleMessages.map(item => [typeName(item), item] as const))('%s', (_name, item) => {
    it('has a generated table with one entry per field that has rules', async () => {
      const rules = await loadTable(item);

      expect(rules, `${item.exportName} is not generated for ${item.file.name}`).toBeDefined();
      expect(Object.keys(rules?.fields ?? {}).toSorted()).toEqual(
        item.message.fields
          .filter(field => hasOption(field, fieldRulesExtension))
          .map(field => field.localName)
          .toSorted(),
      );
    });

    const ruleFields = item.message.fields.filter(field => hasOption(field, fieldRulesExtension));

    it.each(ruleFields.map(field => [field.localName, field] as const))(
      'reports the same rule ids as protovalidate for %s',
      async (_fieldName, field) => {
        const rules = await loadTable(item);
        const fieldRules = rules?.fields[field.localName];

        expect(rules).toBeDefined();
        expect(fieldRules).toBeDefined();

        if (rules === undefined || fieldRules === undefined || fieldRules.isServerOnly === true) {
          return;
        }

        const corpus = buildFieldCorpus(fieldRules, field);
        const comparison = compareField(item, rules, field, corpus);

        expect(comparison.compared).toBeGreaterThan(0);
        expect(comparison.skipped).toBeLessThan(comparison.compared);
      },
    );
  });

  it.each(['name', 'timeZone'])('requires %s of CreateWarehouseRequest on the client and at protovalidate', async (fieldName) => {
    const item = ruleMessages.find(candidate => typeName(candidate) === 'organization.v1.CreateWarehouseRequest');
    const rules = item === undefined ? undefined : await loadTable(item);
    const field = item?.message.fields.find(candidate => candidate.localName === fieldName);

    expect(item).toBeDefined();
    expect(field).toBeDefined();
    expect(rules?.fields[fieldName]?.isRequired).toBe(true);

    if (item === undefined || rules === undefined || field === undefined) {
      return;
    }

    const emptyMessage = buildMessageWithValue(item.message, field, { [fieldName]: '' });
    const violations = emptyMessage === undefined ? [] : collectViolations(item.message, emptyMessage.message);

    expect(violations.filter(violation => violation.fieldPath === field.name).map(violation => violation.ruleId)).toEqual(['required']);
    expect(validateFormValues(rules, { [fieldName]: '' }, [fieldName]).map(issue => issue.ruleId)).toEqual(['required']);
    expect(validateFormValues(rules, { [fieldName]: fieldName === 'name' ? 'Склад' : 'Europe/Moscow' }, [fieldName])).toEqual([]);
  });

  it('lists the fields that stay on the server', async () => {
    const serverOnlyFields: string[] = [];

    for (const item of ruleMessages) {
      const rules = await loadTable(item);

      for (const [name, fieldRules] of Object.entries(rules?.fields ?? {})) {
        if (fieldRules.isServerOnly === true) {
          serverOnlyFields.push(`${typeName(item)}.${name}`);
        }
      }
    }

    expect(serverOnlyFields).toEqual(EXPECTED_SERVER_ONLY_FIELDS);
  });

  it('lists the messages whose own rules stay on the server', async () => {
    const serverOnlyMessages: string[] = [];

    for (const item of ruleMessages) {
      const rules = await loadTable(item);

      if (rules?.hasServerOnlyMessageRules === true) {
        serverOnlyMessages.push(typeName(item));
      }
    }

    expect(serverOnlyMessages).toEqual(EXPECTED_SERVER_ONLY_MESSAGES);
  });

  it('exports no table for a message without rules', async () => {
    const exportNames = new Map<string, string[]>();

    for (const item of ruleMessages) {
      exportNames.set(item.file.name, [...(exportNames.get(item.file.name) ?? []), item.exportName]);
    }

    for (const [fileName, expected] of exportNames) {
      const loaded = await importTables(fileName);

      expect(isRecord(loaded) ? Object.keys(loaded).toSorted() : []).toEqual(expected.toSorted());
    }
  });
});

describe('pattern samples', () => {
  const entries = Object.entries(PATTERN_SAMPLES);

  it.each(entries)('%s: matching and non-matching samples really match and miss', (pattern, samples) => {
    const regex = new RegExp(pattern, 'u');

    expect(samples.matching.filter(sample => !regex.test(sample))).toEqual([]);
    expect(samples.nonMatching.filter(sample => regex.test(sample))).toEqual([]);
    expect(samples.matching.length).toBeGreaterThan(0);
    expect(samples.nonMatching.length).toBeGreaterThan(0);
  });

  it('has samples for every pattern in the generated tables', async () => {
    const patterns = new Set<string>();

    for (const item of ruleMessages) {
      const rules = await loadTable(item);

      for (const fieldRules of Object.values(rules?.fields ?? {})) {
        if (fieldRules.kind === 'string' && fieldRules.pattern !== undefined) {
          patterns.add(fieldRules.pattern);
        }

        if (fieldRules.kind === 'repeated' && fieldRules.items?.kind === 'string' && fieldRules.items.pattern !== undefined) {
          patterns.add(fieldRules.items.pattern);
        }
      }
    }

    expect([...patterns].filter(pattern => PATTERN_SAMPLES[pattern] === undefined)).toEqual([]);
    expect(Object.keys(PATTERN_SAMPLES).filter(pattern => !patterns.has(pattern))).toEqual([]);
  });
});
