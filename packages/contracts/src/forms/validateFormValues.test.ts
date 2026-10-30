import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  FieldCheckRunnerValue,
  FormFieldIssueValue,
  FormFieldRulesValue,
  FormRulesValue,
} from './formRuleTypes';

import { runFieldCheck } from './checks/runFieldCheck';
import { validateFormValues } from './validateFormValues';

const singleField = (field: FormFieldRulesValue): FormRulesValue => ({ fields: { value: field } });

const ruleIdsOf = (field: FormFieldRulesValue, value: unknown): string[] =>
  validateFormValues(singleField(field), { value }, ['value']).map(issue => issue.ruleId);

const validUuid = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';

describe('validateFormValues: string rules', () => {
  const lengthRules: FormFieldRulesValue = {
    kind: 'string',
    maxLen: 5,
    minLen: 2,
    protoName: 'value',
  };

  it('accepts lengths on both borders and rejects one step outside', () => {
    expect(ruleIdsOf(lengthRules, 'ab')).toEqual([]);
    expect(ruleIdsOf(lengthRules, 'abcde')).toEqual([]);
    expect(ruleIdsOf(lengthRules, 'a')).toEqual(['string.min_len']);
    expect(ruleIdsOf(lengthRules, 'abcdef')).toEqual(['string.max_len']);
  });

  it('treats a missing value as the empty string', () => {
    expect(ruleIdsOf(lengthRules, undefined)).toEqual(['string.min_len']);
    expect(ruleIdsOf(lengthRules, null)).toEqual(['string.min_len']);
    expect(validateFormValues(singleField(lengthRules), {}, ['value'])).toEqual([
      { field: 'value', ruleId: 'string.min_len' },
    ]);
  });

  it('counts Unicode code points instead of UTF-16 units', () => {
    expect(ruleIdsOf(lengthRules, '😀😀😀😀😀')).toEqual([]);
    expect(ruleIdsOf(lengthRules, '😀😀😀😀😀😀')).toEqual(['string.max_len']);
    expect(ruleIdsOf(lengthRules, '😀')).toEqual(['string.min_len']);
  });

  it('counts a lone surrogate as one code point', () => {
    expect(ruleIdsOf(lengthRules, '\ud83dab')).toEqual([]);
    expect(ruleIdsOf(lengthRules, '\ud83d')).toEqual(['string.min_len']);
  });

  it('checks the exact length', () => {
    const rules: FormFieldRulesValue = { kind: 'string', len: 3, protoName: 'value' };

    expect(ruleIdsOf(rules, 'abc')).toEqual([]);
    expect(ruleIdsOf(rules, 'ab')).toEqual(['string.len']);
    expect(ruleIdsOf(rules, 'abcd')).toEqual(['string.len']);
    expect(ruleIdsOf(rules, '')).toEqual(['string.len']);
  });

  it('reports several length rules at once in the order of protovalidate', () => {
    const rules: FormFieldRulesValue = {
      kind: 'string',
      len: 4,
      maxLen: 1,
      minLen: 6,
      protoName: 'value',
    };

    expect(ruleIdsOf(rules, 'abc')).toEqual(['string.len', 'string.min_len', 'string.max_len']);
    expect(ruleIdsOf(rules, 'abcdefg')).toEqual(['string.len', 'string.max_len']);
  });

  it('searches the pattern anywhere unless it is anchored', () => {
    const open: FormFieldRulesValue = { kind: 'string', pattern: 'ab', protoName: 'value' };
    const anchored: FormFieldRulesValue = { kind: 'string', pattern: '^ab$', protoName: 'value' };

    expect(ruleIdsOf(open, 'xxabxx')).toEqual([]);
    expect(ruleIdsOf(open, 'xxax')).toEqual(['string.pattern']);
    expect(ruleIdsOf(anchored, 'ab')).toEqual([]);
    expect(ruleIdsOf(anchored, 'xab')).toEqual(['string.pattern']);
    expect(ruleIdsOf(anchored, 'ab\n')).toEqual(['string.pattern']);
  });

  it('applies the pattern to the empty string too', () => {
    const rules: FormFieldRulesValue = { kind: 'string', pattern: '^[A-Z]{3}$', protoName: 'value' };

    expect(ruleIdsOf(rules, '')).toEqual(['string.pattern']);
    expect(ruleIdsOf(rules, undefined)).toEqual(['string.pattern']);
  });

  it('matches the pattern by code points', () => {
    const rules: FormFieldRulesValue = { kind: 'string', pattern: '^.$', protoName: 'value' };

    expect(ruleIdsOf(rules, '😀')).toEqual([]);
    expect(ruleIdsOf(rules, '😀😀')).toEqual(['string.pattern']);
  });

  it('does not report a pattern that cannot be compiled', () => {
    const rules: FormFieldRulesValue = { kind: 'string', pattern: '(', protoName: 'value' };

    expect(ruleIdsOf(rules, 'anything')).toEqual([]);
  });

  it('checks prefix, suffix, contains and not_contains', () => {
    const rules: FormFieldRulesValue = {
      contains: 'mid',
      kind: 'string',
      notContains: 'bad',
      prefix: 'pre',
      protoName: 'value',
      suffix: 'end',
    };

    expect(ruleIdsOf(rules, 'pre-mid-end')).toEqual([]);
    expect(ruleIdsOf(rules, 'xre-mid-end')).toEqual(['string.prefix']);
    expect(ruleIdsOf(rules, 'pre-mid-enx')).toEqual(['string.suffix']);
    expect(ruleIdsOf(rules, 'pre-mix-end')).toEqual(['string.contains']);
    expect(ruleIdsOf(rules, 'pre-mid-bad-end')).toEqual(['string.not_contains']);
    expect(ruleIdsOf(rules, '')).toEqual(['string.prefix', 'string.suffix', 'string.contains']);
  });

  describe('uuid', () => {
    const rules: FormFieldRulesValue = { isUuid: true, kind: 'string', protoName: 'value' };

    it('accepts a UUID of any case and any version digits', () => {
      expect(ruleIdsOf(rules, validUuid)).toEqual([]);
      expect(ruleIdsOf(rules, validUuid.toUpperCase())).toEqual([]);
      expect(ruleIdsOf(rules, '00000000-0000-0000-0000-000000000000')).toEqual([]);
    });

    it('reports the dedicated rule for the empty value', () => {
      expect(ruleIdsOf(rules, '')).toEqual(['string.uuid_empty']);
      expect(ruleIdsOf(rules, undefined)).toEqual(['string.uuid_empty']);
    });

    it('rejects malformed values', () => {
      expect(ruleIdsOf(rules, 'org-1')).toEqual(['string.uuid']);
      expect(ruleIdsOf(rules, `${validUuid}0`)).toEqual(['string.uuid']);
      expect(ruleIdsOf(rules, `${validUuid}\n`)).toEqual(['string.uuid']);
      expect(ruleIdsOf(rules, ` ${validUuid}`)).toEqual(['string.uuid']);
      expect(ruleIdsOf(rules, validUuid.replaceAll('-', ''))).toEqual(['string.uuid']);
      expect(ruleIdsOf(rules, validUuid.replace('3f', 'zz'))).toEqual(['string.uuid']);
    });
  });
});

describe('validateFormValues: integer rules', () => {
  const rangeRules: FormFieldRulesValue = {
    gte: 0,
    kind: 'integer',
    lte: 200,
    protoName: 'value',
    type: 'int32',
  };

  it('uses the composite id for an inclusive range and checks both borders', () => {
    expect(ruleIdsOf(rangeRules, 0)).toEqual([]);
    expect(ruleIdsOf(rangeRules, 200)).toEqual([]);
    expect(ruleIdsOf(rangeRules, -1)).toEqual(['int32.gte_lte']);
    expect(ruleIdsOf(rangeRules, 201)).toEqual(['int32.gte_lte']);
  });

  it('applies the rules to the zero value of a missing field', () => {
    const rules: FormFieldRulesValue = { gte: 1, kind: 'integer', protoName: 'value', type: 'int32' };

    expect(ruleIdsOf(rules, undefined)).toEqual(['int32.gte']);
    expect(ruleIdsOf(rules, 0)).toEqual(['int32.gte']);
    expect(ruleIdsOf(rangeRules, undefined)).toEqual([]);
  });

  it('distinguishes exclusive and inclusive bounds', () => {
    const rules: FormFieldRulesValue = { gt: 0, kind: 'integer', lt: 10, protoName: 'value', type: 'int32' };

    expect(ruleIdsOf(rules, 1)).toEqual([]);
    expect(ruleIdsOf(rules, 9)).toEqual([]);
    expect(ruleIdsOf(rules, 0)).toEqual(['int32.gt_lt']);
    expect(ruleIdsOf(rules, 10)).toEqual(['int32.gt_lt']);
  });

  it('builds mixed composite ids', () => {
    const gtLte: FormFieldRulesValue = { gt: 0, kind: 'integer', lte: 10, protoName: 'value', type: 'sint32' };
    const gteLt: FormFieldRulesValue = { gte: 0, kind: 'integer', lt: 10, protoName: 'value', type: 'uint32' };

    expect(ruleIdsOf(gtLte, 0)).toEqual(['sint32.gt_lte']);
    expect(ruleIdsOf(gtLte, 10)).toEqual([]);
    expect(ruleIdsOf(gteLt, 10)).toEqual(['uint32.gte_lt']);
    expect(ruleIdsOf(gteLt, 0)).toEqual([]);
  });

  it('uses single-bound ids', () => {
    const lower: FormFieldRulesValue = { gt: 5, kind: 'integer', protoName: 'value', type: 'fixed32' };
    const upper: FormFieldRulesValue = { kind: 'integer', lt: 5, protoName: 'value', type: 'sfixed32' };
    const upperInclusive: FormFieldRulesValue = { kind: 'integer', lte: 5, protoName: 'value', type: 'uint32' };

    expect(ruleIdsOf(lower, 5)).toEqual(['fixed32.gt']);
    expect(ruleIdsOf(lower, 6)).toEqual([]);
    expect(ruleIdsOf(upper, 5)).toEqual(['sfixed32.lt']);
    expect(ruleIdsOf(upper, 4)).toEqual([]);
    expect(ruleIdsOf(upperInclusive, 6)).toEqual(['uint32.lte']);
    expect(ruleIdsOf(upperInclusive, 5)).toEqual([]);
  });

  it('inverts the range when the upper bound is below the lower bound', () => {
    const rules: FormFieldRulesValue = { gte: 10, kind: 'integer', lte: 5, protoName: 'value', type: 'int32' };

    expect(ruleIdsOf(rules, 7)).toEqual(['int32.gte_lte_exclusive']);
    expect(ruleIdsOf(rules, 5)).toEqual([]);
    expect(ruleIdsOf(rules, 10)).toEqual([]);
    expect(ruleIdsOf(rules, 0)).toEqual([]);
    expect(ruleIdsOf(rules, 100)).toEqual([]);
  });

  it('compares 64-bit values given as bigint and number', () => {
    const rules: FormFieldRulesValue = { gte: 1n, kind: 'integer', lte: 9007199254740993n, protoName: 'value', type: 'int64' };

    expect(ruleIdsOf(rules, 9007199254740993n)).toEqual([]);
    expect(ruleIdsOf(rules, 9007199254740994n)).toEqual(['int64.gte_lte']);
    expect(ruleIdsOf(rules, 1)).toEqual([]);
    expect(ruleIdsOf(rules, 0n)).toEqual(['int64.gte_lte']);
    expect(ruleIdsOf(rules, undefined)).toEqual(['int64.gte_lte']);
  });

  it('does not report values that are not integers', () => {
    expect(ruleIdsOf(rangeRules, '500')).toEqual([]);
    expect(ruleIdsOf(rangeRules, 1.5)).toEqual([]);
    expect(ruleIdsOf(rangeRules, Number.NaN)).toEqual([]);
    expect(ruleIdsOf(rangeRules, Infinity)).toEqual([]);
    expect(ruleIdsOf(rangeRules, {})).toEqual([]);
  });
});

describe('validateFormValues: enum rules', () => {
  const rules: FormFieldRulesValue = {
    definedValues: [0, 1, 2, 3],
    kind: 'enum',
    notIn: [0],
    protoName: 'value',
  };

  it('reports undefined enum numbers with defined_only', () => {
    expect(ruleIdsOf(rules, 2)).toEqual([]);
    expect(ruleIdsOf(rules, 4)).toEqual(['enum.defined_only']);
    expect(ruleIdsOf(rules, -1)).toEqual(['enum.defined_only']);
  });

  it('reports defined_only before not_in in the order of protovalidate', () => {
    const wide: FormFieldRulesValue = { definedValues: [1, 2], kind: 'enum', notIn: [7], protoName: 'value' };

    expect(ruleIdsOf(wide, 7)).toEqual(['enum.defined_only', 'enum.not_in']);
  });

  it('applies not_in to the zero value of a missing field', () => {
    expect(ruleIdsOf(rules, undefined)).toEqual(['enum.not_in']);
    expect(ruleIdsOf(rules, 0)).toEqual(['enum.not_in']);
  });

  it('checks in and const', () => {
    const inRules: FormFieldRulesValue = { in: [1, 2], kind: 'enum', protoName: 'value' };
    const constRules: FormFieldRulesValue = { equalTo: 2, kind: 'enum', protoName: 'value' };

    expect(ruleIdsOf(inRules, 1)).toEqual([]);
    expect(ruleIdsOf(inRules, 3)).toEqual(['enum.in']);
    expect(ruleIdsOf(constRules, 2)).toEqual([]);
    expect(ruleIdsOf(constRules, 1)).toEqual(['enum.const']);
  });

  it('does not report values that are not enum numbers', () => {
    expect(ruleIdsOf(rules, '1')).toEqual([]);
    expect(ruleIdsOf(rules, 1.5)).toEqual([]);
    expect(ruleIdsOf(rules, 1n)).toEqual([]);
  });
});

describe('validateFormValues: repeated rules', () => {
  const rules: FormFieldRulesValue = {
    isUnique: true,
    items: {
      definedValues: [0, 1, 2, 3],
      kind: 'enum',
      notIn: [0],
    },
    kind: 'repeated',
    maxItems: 3,
    minItems: 1,
    protoName: 'value',
  };

  it('treats a missing value as the empty list', () => {
    expect(ruleIdsOf(rules, undefined)).toEqual(['repeated.min_items']);
    expect(ruleIdsOf(rules, [])).toEqual(['repeated.min_items']);
  });

  it('checks item counts on both borders', () => {
    expect(ruleIdsOf(rules, [1])).toEqual([]);
    expect(ruleIdsOf(rules, [1, 2, 3])).toEqual([]);
    expect(ruleIdsOf(rules, [1, 2, 3, 1])).toEqual(['repeated.max_items', 'repeated.unique']);
  });

  it('reports unique once however many duplicates there are', () => {
    expect(ruleIdsOf(rules, [1, 1])).toEqual(['repeated.unique']);
    expect(ruleIdsOf(rules, [1, 1, 1])).toEqual(['repeated.unique']);
  });

  it('reports item violations on the list field with the item rule id', () => {
    expect(ruleIdsOf(rules, [0])).toEqual(['enum.not_in']);
    expect(ruleIdsOf(rules, [9])).toEqual(['enum.defined_only']);
  });

  it('reports each item rule id once when several items break it', () => {
    expect(ruleIdsOf(rules, [0, 9, 8])).toEqual(['enum.not_in', 'enum.defined_only']);
  });

  it('puts list rules before item rules', () => {
    expect(ruleIdsOf(rules, [9, 9])).toEqual(['repeated.unique', 'enum.defined_only']);
    expect(ruleIdsOf(rules, [0, 0])).toEqual(['repeated.unique', 'enum.not_in']);
  });

  it('checks string and integer items', () => {
    const strings: FormFieldRulesValue = {
      items: { isUuid: true, kind: 'string' },
      kind: 'repeated',
      protoName: 'value',
    };
    const integers: FormFieldRulesValue = {
      items: { gte: 1, kind: 'integer', type: 'int32' },
      kind: 'repeated',
      protoName: 'value',
    };

    expect(ruleIdsOf(strings, [validUuid, 'x', ''])).toEqual(['string.uuid', 'string.uuid_empty']);
    expect(ruleIdsOf(integers, [1, 0, 5])).toEqual(['int32.gte']);
  });

  it('skips elements of the wrong type and does not fail on a value that is not a list', () => {
    expect(ruleIdsOf(rules, [1, 'x', null])).toEqual([]);
    expect(ruleIdsOf(rules, 'not-a-list')).toEqual([]);
    expect(ruleIdsOf(rules, 5)).toEqual([]);
  });

  it('compares unique elements with strict equality', () => {
    const strings: FormFieldRulesValue = { isUnique: true, kind: 'repeated', protoName: 'value' };

    expect(ruleIdsOf(strings, ['a', 'b'])).toEqual([]);
    expect(ruleIdsOf(strings, ['a', 'a'])).toEqual(['repeated.unique']);
    expect(ruleIdsOf(strings, ['1', 1])).toEqual([]);
    expect(ruleIdsOf(strings, [Number.NaN, Number.NaN])).toEqual([]);
  });
});

describe('validateFormValues: required and ignore', () => {
  it('reports required for every kind of zero value and skips the other rules', () => {
    const text: FormFieldRulesValue = {
      isRequired: true,
      kind: 'string',
      minLen: 3,
      protoName: 'value',
    };
    const integer: FormFieldRulesValue = {
      gte: 5,
      isRequired: true,
      kind: 'integer',
      protoName: 'value',
      type: 'int32',
    };
    const choice: FormFieldRulesValue = {
      definedValues: [0, 1],
      isRequired: true,
      kind: 'enum',
      protoName: 'value',
    };
    const list: FormFieldRulesValue = {
      isRequired: true,
      kind: 'repeated',
      minItems: 2,
      protoName: 'value',
    };

    expect(ruleIdsOf(text, '')).toEqual(['required']);
    expect(ruleIdsOf(text, undefined)).toEqual(['required']);
    expect(ruleIdsOf(text, 'ab')).toEqual(['string.min_len']);
    expect(ruleIdsOf(integer, 0)).toEqual(['required']);
    expect(ruleIdsOf(integer, 0n)).toEqual(['required']);
    expect(ruleIdsOf(integer, 4)).toEqual(['int32.gte']);
    expect(ruleIdsOf(choice, 0)).toEqual(['required']);
    expect(ruleIdsOf(choice, 1)).toEqual([]);
    expect(ruleIdsOf(list, [])).toEqual(['required']);
    expect(ruleIdsOf(list, [1])).toEqual(['repeated.min_items']);
  });

  it('skips the rules of an empty value with ifZeroValue', () => {
    const rules: FormFieldRulesValue = {
      ignore: 'ifZeroValue',
      kind: 'string',
      minLen: 3,
      protoName: 'value',
    };

    expect(ruleIdsOf(rules, '')).toEqual([]);
    expect(ruleIdsOf(rules, undefined)).toEqual([]);
    expect(ruleIdsOf(rules, 'ab')).toEqual(['string.min_len']);
  });

  it('keeps required enforced together with ifZeroValue', () => {
    const rules: FormFieldRulesValue = {
      ignore: 'ifZeroValue',
      isRequired: true,
      kind: 'string',
      minLen: 3,
      protoName: 'value',
    };

    expect(ruleIdsOf(rules, '')).toEqual(['required']);
  });

  it('skips the field entirely with always, required included', () => {
    const rules: FormFieldRulesValue = {
      ignore: 'always',
      isRequired: true,
      kind: 'string',
      minLen: 3,
      protoName: 'value',
    };

    expect(ruleIdsOf(rules, '')).toEqual([]);
    expect(ruleIdsOf(rules, 'a')).toEqual([]);
  });

  it('checks a field with explicit presence only when it is set', () => {
    const rules: FormFieldRulesValue = {
      hasPresence: true,
      kind: 'string',
      minLen: 3,
      protoName: 'value',
    };
    const requiredRules: FormFieldRulesValue = { ...rules, isRequired: true };

    expect(ruleIdsOf(rules, undefined)).toEqual([]);
    expect(ruleIdsOf(rules, '')).toEqual(['string.min_len']);
    expect(ruleIdsOf(requiredRules, undefined)).toEqual(['required']);
    expect(ruleIdsOf(requiredRules, '')).toEqual(['string.min_len']);
  });
});

describe('validateFormValues: field selection', () => {
  const rules: FormRulesValue = {
    fields: {
      first: { kind: 'string', minLen: 1, protoName: 'first' },
      second: { kind: 'string', minLen: 1, protoName: 'second' },
      serverOnly: { isServerOnly: true, kind: 'string', minLen: 1, protoName: 'server_only' },
    },
  };

  it('checks only the named fields in the order of the names', () => {
    expect(validateFormValues(rules, {}, ['second', 'first'])).toEqual([
      { field: 'second', ruleId: 'string.min_len' },
      { field: 'first', ruleId: 'string.min_len' },
    ]);
    expect(validateFormValues(rules, {}, ['first'])).toEqual([
      { field: 'first', ruleId: 'string.min_len' },
    ]);
  });

  it('ignores unknown fields and fields that only the server checks', () => {
    expect(validateFormValues(rules, {}, ['serverOnly', 'unknown', 'toString', 'constructor'])).toEqual([]);
  });

  it('ignores opaque fields', () => {
    const opaque: FormRulesValue = {
      fields: { blob: { isServerOnly: true, kind: 'opaque', protoName: 'blob' } },
    };

    expect(validateFormValues(opaque, {}, ['blob'])).toEqual([]);
  });

  it('does not read inherited keys of the values', () => {
    const inherited = Object.create({ first: 'x' }) as Record<string, unknown>;

    expect(validateFormValues(rules, inherited, ['first'])).toEqual([
      { field: 'first', ruleId: 'string.min_len' },
    ]);
  });

  it('returns nothing for valid values', () => {
    expect(validateFormValues(rules, { first: 'a', second: 'b' }, ['first', 'second'])).toEqual([]);
  });
});

describe('validateFormValues: field checks', () => {
  const validateWithChecks = (
    rules: FormRulesValue,
    values: Readonly<Record<string, unknown>>,
    fieldNames: readonly string[],
  ): FormFieldIssueValue[] => validateFormValues(rules, values, fieldNames, { runCheck: runFieldCheck });

  const rules: FormRulesValue = {
    fields: {
      'bank.bik': {
        check: { kind: 'bik' },
        kind: 'string',
        pattern: '^04[0-9]{7}$',
        protoName: 'bank.bik',
      },
      'bank.correspondentAccount': {
        check: { kind: 'correspondentAccount', peerField: 'bank.bik' },
        kind: 'string',
        pattern: '^[0-9]{20}$',
        protoName: 'bank.correspondent_account',
      },
      'bank.settlementAccount': {
        check: { kind: 'settlementAccount', peerField: 'bank.bik' },
        kind: 'string',
        pattern: '^[0-9]{20}$',
        protoName: 'bank.settlement_account',
      },
      'inn': {
        check: { kind: 'inn' },
        kind: 'string',
        maxLen: 12,
        protoName: 'inn',
      },
    },
  };
  const names = ['bank.bik', 'bank.settlementAccount', 'bank.correspondentAccount', 'inn'];
  const validValues = {
    'bank.bik': '040000777',
    'bank.correspondentAccount': '30101810900000000777',
    'bank.settlementAccount': '40702810700000000123',
    'inn': '0000000018',
  };

  it('accepts correct values', () => {
    expect(validateWithChecks(rules, validValues, names)).toEqual([]);
  });

  it('reports the rule id of a failed check', () => {
    expect(validateWithChecks(rules, { ...validValues, inn: '0000000019' }, names)).toEqual([
      { field: 'inn', ruleId: 'field_check.inn' },
    ]);
    expect(validateWithChecks(rules, { ...validValues, 'bank.settlementAccount': '40702810800000000123' }, names)).toEqual([
      { field: 'bank.settlementAccount', ruleId: 'field_check.settlement_account' },
    ]);
    expect(validateWithChecks(rules, { ...validValues, 'bank.correspondentAccount': '30101810800000000777' }, names)).toEqual([
      { field: 'bank.correspondentAccount', ruleId: 'field_check.correspondent_account' },
    ]);
  });

  it('does not check an empty value', () => {
    expect(validateWithChecks(rules, { ...validValues, inn: '' }, names)).toEqual([]);
    expect(validateWithChecks(rules, { ...validValues, 'bank.settlementAccount': '' }, names)).toEqual([
      { field: 'bank.settlementAccount', ruleId: 'string.pattern' },
    ]);
  });

  it('does not run the check of a field that already broke its own rules', () => {
    expect(validateWithChecks(rules, { ...validValues, inn: '0000000019000' }, names)).toEqual([
      { field: 'inn', ruleId: 'string.max_len' },
    ]);
    expect(validateWithChecks(rules, { ...validValues, 'bank.settlementAccount': '4070281080000000012' }, names)).toEqual([
      { field: 'bank.settlementAccount', ruleId: 'string.pattern' },
    ]);
  });

  it('skips an account while the BIK is empty or broke its rules or its check', () => {
    const wrongAccounts = {
      'bank.correspondentAccount': '30101810800000000777',
      'bank.settlementAccount': '40702810800000000123',
    };

    expect(validateWithChecks(rules, { ...wrongAccounts, 'bank.bik': '' }, names)).toEqual([
      { field: 'bank.bik', ruleId: 'string.pattern' },
    ]);
    expect(validateWithChecks(rules, { ...wrongAccounts, 'bank.bik': '' }, ['bank.settlementAccount'])).toEqual([]);
    expect(validateWithChecks(rules, { ...wrongAccounts, 'bank.bik': '04000077' }, names)).toEqual([
      { field: 'bank.bik', ruleId: 'string.pattern' },
    ]);
    expect(validateWithChecks(rules, wrongAccounts, ['bank.settlementAccount', 'bank.correspondentAccount'])).toEqual([]);
  });

  it('reads the BIK of the neighbour even when the BIK is not among the checked names', () => {
    expect(validateWithChecks(
      rules,
      { 'bank.bik': '040000777', 'bank.settlementAccount': '40702810800000000123' },
      ['bank.settlementAccount'],
    )).toEqual([{ field: 'bank.settlementAccount', ruleId: 'field_check.settlement_account' }]);
  });

  it('does not run the check of a field that only the server checks', () => {
    const serverOnly: FormRulesValue = {
      fields: { inn: { check: { kind: 'inn' }, isServerOnly: true, kind: 'string', protoName: 'inn' } },
    };

    expect(validateWithChecks(serverOnly, { inn: '0000000019' }, ['inn'])).toEqual([]);
  });

  it('ignores a value that is not a string', () => {
    expect(validateWithChecks(rules, { ...validValues, inn: 5 }, ['inn'])).toEqual([]);
    expect(validateWithChecks(rules, { ...validValues, inn: undefined }, ['inn'])).toEqual([]);
  });

  it('does not run the check of a field with ignore always', () => {
    const ignored: FormRulesValue = {
      fields: { inn: { check: { kind: 'inn' }, ignore: 'always', kind: 'string', protoName: 'inn' } },
    };

    expect(validateWithChecks(ignored, { inn: '0000000019' }, ['inn'])).toEqual([]);
  });
});

describe('validateFormValues: without a check runner', () => {
  const rules: FormRulesValue = {
    fields: {
      'bank.bik': {
        check: { kind: 'bik' },
        kind: 'string',
        pattern: '^04[0-9]{7}$',
        protoName: 'bank.bik',
      },
      'bank.settlementAccount': {
        check: { kind: 'settlementAccount', peerField: 'bank.bik' },
        kind: 'string',
        pattern: '^[0-9]{20}$',
        protoName: 'bank.settlement_account',
      },
      'inn': {
        check: { kind: 'inn' },
        kind: 'string',
        maxLen: 12,
        protoName: 'inn',
      },
    },
  };
  const names = ['bank.bik', 'bank.settlementAccount', 'inn'];
  const wrongValues = {
    'bank.bik': '040000777',
    'bank.settlementAccount': '40702810800000000123',
    'inn': '0000000019',
  };

  it('leaves the checksum to the server and keeps the own rules', () => {
    expect(validateFormValues(rules, wrongValues, names)).toEqual([]);
    expect(validateFormValues(rules, wrongValues, names, {})).toEqual([]);
    expect(validateFormValues(rules, wrongValues, names, { runCheck: undefined })).toEqual([]);
    expect(validateFormValues(rules, { ...wrongValues, inn: '0000000019000' }, names)).toEqual([
      { field: 'inn', ruleId: 'string.max_len' },
    ]);
  });

  it('runs the given runner only for fields without own violations', () => {
    const calls: string[] = [];
    const runCheck: FieldCheckRunnerValue = (check, value, peerValue) => {
      calls.push(`${check.kind}:${value}:${peerValue ?? '-'}`);

      return `custom.${check.kind}`;
    };

    expect(validateFormValues(rules, { ...wrongValues, inn: '0000000019000' }, names, { runCheck })).toEqual([
      { field: 'bank.bik', ruleId: 'custom.bik' },
      { field: 'inn', ruleId: 'string.max_len' },
    ]);
    expect(calls).toEqual(['bik:040000777:-', 'bik:040000777:-']);
  });
});

describe('validateFormValues: nested fields and unset ancestors', () => {
  const rules: FormRulesValue = {
    fields: {
      'bank': { hasPresence: true, isRequired: true, isServerOnly: true, kind: 'opaque', protoName: 'bank' },
      'bank.bankName': { isRequired: true, kind: 'string', maxLen: 10, protoName: 'bank_name' },
      'bank.bik': {
        check: { kind: 'bik' },
        kind: 'string',
        protoName: 'bik',
      },
      'date': { isServerOnly: true, kind: 'opaque', protoName: 'date' },
      'date.day': { gte: 1, kind: 'integer', lte: 31, protoName: 'day', type: 'int32' },
      'deep': { isServerOnly: true, kind: 'opaque', protoName: 'deep' },
      'deep.inner': { isServerOnly: true, kind: 'opaque', protoName: 'inner' },
      'deep.inner.name': { isRequired: true, kind: 'string', protoName: 'name' },
    },
  };
  const fieldNames = ['bank.bankName', 'bank.bik', 'date.day', 'deep.inner.name'];

  it('checks nested fields as before when the ancestor is absent from the values', () => {
    expect(validateFormValues(rules, {}, fieldNames, { runCheck: runFieldCheck })).toEqual([
      { field: 'bank.bankName', ruleId: 'required' },
      { field: 'date.day', ruleId: 'int32.gte_lte' },
      { field: 'deep.inner.name', ruleId: 'required' },
    ]);
  });

  it('skips the nested fields of an ancestor that is set to undefined', () => {
    const values = { bank: undefined, date: undefined, deep: undefined };

    expect(validateFormValues(rules, values, fieldNames, { runCheck: runFieldCheck })).toEqual([]);
  });

  it('skips the nested fields of an ancestor that is set to null', () => {
    expect(validateFormValues(rules, { bank: null, date: null, deep: null }, fieldNames, { runCheck: runFieldCheck })).toEqual([]);
  });

  it('skips the field when the nearest ancestor is set and a farther one is unset', () => {
    expect(validateFormValues(rules, { 'deep': undefined, 'deep.inner': {} }, ['deep.inner.name'])).toEqual([]);
  });

  it('skips the field when only the nearest ancestor is unset', () => {
    expect(validateFormValues(rules, { 'deep.inner': undefined }, ['deep.inner.name'])).toEqual([]);
  });

  it('checks the field when its ancestors are set to values', () => {
    expect(validateFormValues(rules, { 'bank': {}, 'deep': {}, 'deep.inner': {} }, ['bank.bankName', 'deep.inner.name'])).toEqual([
      { field: 'bank.bankName', ruleId: 'required' },
      { field: 'deep.inner.name', ruleId: 'required' },
    ]);
  });

  it('does not run the field check of a field with an unset ancestor', () => {
    const calls: string[] = [];
    const runCheck: FieldCheckRunnerValue = (_check, value) => {
      calls.push(value);

      return 'field_check.bik';
    };

    expect(validateFormValues(rules, { 'bank': undefined, 'bank.bik': '040000501' }, ['bank.bik'], { runCheck })).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('does not take a prefix without a table entry for an ancestor', () => {
    const bare: FormRulesValue = {
      fields: { 'group.value': { isRequired: true, kind: 'string', protoName: 'value' } },
    };

    expect(validateFormValues(bare, { group: undefined }, ['group.value'])).toEqual([
      { field: 'group.value', ruleId: 'required' },
    ]);
  });

  it('does not read an inherited key as the ancestor value', () => {
    const inherited = Object.create({ bank: undefined }) as Record<string, unknown>;

    expect(validateFormValues(rules, inherited, ['bank.bankName'])).toEqual([
      { field: 'bank.bankName', ruleId: 'required' },
    ]);
  });
});
