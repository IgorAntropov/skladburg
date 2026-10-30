import { runInNewContext } from 'node:vm';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { FormRulesValue } from '../src/forms/formRuleTypes';

import {
  renderFormRulesLiteral,
  renderFormRulesModule,
} from './renderFormRulesModule';

const evaluateLiteral = (literal: string): unknown => {
  const value: unknown = runInNewContext(`(${literal})`);

  return value;
};

const everyKindRules: FormRulesValue = {
  fields: {
    capabilities: {
      isUnique: true,
      items: { definedValues: [0, 1, 2], kind: 'enum', notIn: [0] },
      kind: 'repeated',
      maxItems: 5,
      minItems: 1,
      protoName: 'capabilities',
    },
    mode: {
      equalTo: 1,
      hasPresence: true,
      ignore: 'ifZeroValue',
      in: [1, 2],
      isRequired: true,
      kind: 'enum',
      protoName: 'mode',
    },
    name: { kind: 'string', maxLen: 120, minLen: 1, protoName: 'name' },
    quantity: {
      gt: -9007199254740993n,
      kind: 'integer',
      lte: 9223372036854775807n,
      protoName: 'quantity',
      type: 'int64',
    },
    size: { gte: 0, kind: 'integer', lt: 200, protoName: 'size', type: 'int32' },
    unknown: { isServerOnly: true, kind: 'opaque', protoName: 'unknown' },
  },
  hasServerOnlyMessageRules: true,
};

describe('renderFormRulesLiteral', () => {
  it('renders a literal that evaluates back to the same table', () => {
    expect(evaluateLiteral(renderFormRulesLiteral(everyKindRules))).toEqual(everyKindRules);
  });

  it('keeps 64-bit bounds exact as bigint literals', () => {
    const literal = renderFormRulesLiteral({ gt: -9007199254740993n, lte: 9223372036854775807n });

    expect(literal).toContain('gt: -9007199254740993n');
    expect(literal).toContain('lte: 9223372036854775807n');
    expect(evaluateLiteral(literal)).toEqual({ gt: -9007199254740993n, lte: 9223372036854775807n });
  });

  it('escapes strings so that the value survives unchanged', () => {
    const patterns = [
      '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$',
      'back\\slash \\d \\\\',
      'quotes \' " `',
      'line\nbreak\ttab\r',
      'юникод   😀 \u0000',
      '${notATemplate} // not a comment /* nor this */',
      '\ud800',
    ];

    for (const pattern of patterns) {
      expect(evaluateLiteral(renderFormRulesLiteral({ pattern }))).toEqual({ pattern });
    }
  });

  it('sorts keys so that the output does not depend on insertion order', () => {
    const direct = renderFormRulesLiteral({ a: 1, b: { c: 1, d: 2 }, e: 3 });
    const shuffled = renderFormRulesLiteral({ a: 1, b: { c: 1, d: 2 }, e: 3 });

    expect(shuffled).toBe(direct);
    expect(direct.indexOf('a:')).toBeLessThan(direct.indexOf('b:'));
    expect(direct.indexOf('b:')).toBeLessThan(direct.indexOf('e:'));
  });

  it('skips undefined values', () => {
    expect(evaluateLiteral(renderFormRulesLiteral({ a: undefined, b: 1 }))).toEqual({ b: 1 });
  });

  it('quotes keys that are not identifiers', () => {
    const literal = renderFormRulesLiteral({ 'a-b': 1, 'ok_1': 2 });

    expect(literal).toContain('"a-b": 1');
    expect(literal).toContain('ok_1: 2');
  });

  it('quotes dotted keys of nested fields and renders the check object sorted', () => {
    const table = {
      fields: {
        'bank.settlementAccount': {
          check: { kind: 'settlementAccount', peerField: 'bank.bik' },
          kind: 'string',
          protoName: 'bank.settlement_account',
        },
      },
    };
    const literal = renderFormRulesLiteral(table);

    expect(literal).toContain('"bank.settlementAccount": {');
    expect(literal).toContain('check: {\n        kind: "settlementAccount",\n        peerField: "bank.bik",\n      },');
    expect(evaluateLiteral(literal)).toEqual(table);
  });

  it('puts primitive lists on one line and lists of objects on separate lines', () => {
    expect(renderFormRulesLiteral({ list: [0, 1, 2] })).toBe('{\n  list: [0, 1, 2],\n}');
    expect(renderFormRulesLiteral({ list: [] })).toBe('{\n  list: [],\n}');
    expect(renderFormRulesLiteral({ list: [{ a: 1 }] })).toBe('{\n  list: [\n    {\n      a: 1,\n    },\n  ],\n}');
  });

  it('renders the same text on every run', () => {
    expect(renderFormRulesLiteral(everyKindRules)).toBe(renderFormRulesLiteral(everyKindRules));
  });

  it('rejects values that are not data', () => {
    expect(() => renderFormRulesLiteral({ value: null })).toThrow();
    expect(() => renderFormRulesLiteral({ value: () => 1 })).toThrow();
    expect(() => renderFormRulesLiteral({ value: Symbol('x') })).toThrow();
  });
});

describe('renderFormRulesModule', () => {
  const messages = [
    { exportName: 'FirstFormRules', rules: { fields: { name: { kind: 'string', protoName: 'name' } } } },
    { exportName: 'Outer_SecondFormRules', rules: everyKindRules },
  ] satisfies Parameters<typeof renderFormRulesModule>[0];

  it('imports the type and exports every table as a const satisfying it', () => {
    const source = renderFormRulesModule(messages, '../../../../forms/index');

    expect(source.startsWith('import type { FormRulesValue } from "../../../../forms/index";\n\n')).toBe(true);
    expect(source).toContain('export const FirstFormRules = {');
    expect(source).toContain('export const Outer_SecondFormRules = {');
    expect(source.match(/^\} as const satisfies FormRulesValue;$/gm)).toHaveLength(2);
    expect(source.match(/\bexport\b/g)).toHaveLength(2);
    expect(source.endsWith(';\n')).toBe(true);
  });

  it('contains no comments and no header', () => {
    expect(renderFormRulesModule(messages, './forms')).not.toMatch(/\/\/|\/\*/);
  });

  it('keeps each table evaluable as it was rendered', () => {
    const source = renderFormRulesModule(messages, './forms');
    const literals = source.split('export const ').slice(1).map(part => part.slice(part.indexOf('= ') + 2, part.indexOf(' as const')));

    expect(literals.map(evaluateLiteral)).toEqual(messages.map(message => message.rules));
  });

  it('renders only the import for no messages', () => {
    expect(renderFormRulesModule([], './forms')).toBe('import type { FormRulesValue } from "./forms";\n\n');
  });

  it('is deterministic', () => {
    expect(renderFormRulesModule(messages, './forms')).toBe(renderFormRulesModule(messages, './forms'));
  });
});
