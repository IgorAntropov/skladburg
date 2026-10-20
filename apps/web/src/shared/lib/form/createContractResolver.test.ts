import type { FormRulesValue } from '@skladburg/contracts/forms';
import type {
  ResolverOptions,
  ResolverResult,
} from 'react-hook-form';

import { CreateWarehouseRequestFormRules } from '@skladburg/contracts/forms/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createContractResolver } from './createContractResolver';

type TestValues = Record<string, unknown>;

const OPTIONS: ResolverOptions<TestValues> = { fields: {}, shouldUseNativeValidation: undefined };

const CITY_ID = '0b9c1f3e-6d4a-4e55-8f1d-7a2b3c4d5e6f';
const BOARD_NODE_ID = '1c0d2a4f-7e5b-4f66-9a2e-8b3c4d5e6f70';

const WAREHOUSE_FIELDS = ['address', 'boardNodeId', 'capabilities', 'cityId', 'name', 'timeZone'];

const NUMBER_RULES = {
  fields: {
    kind: {
      definedValues: [0, 1, 2],
      kind: 'enum',
      notIn: [0],
      protoName: 'kind',
    },
    kinds: {
      items: { kind: 'integer', lte: 5, type: 'int32' },
      kind: 'repeated',
      protoName: 'kinds',
    },
    note: {
      hasPresence: true,
      kind: 'string',
      minLen: 1,
      protoName: 'note',
    },
    quantity: {
      gte: 1,
      kind: 'integer',
      lte: 10,
      protoName: 'quantity',
      type: 'int32',
    },
    volume: {
      kind: 'integer',
      protoName: 'volume',
      type: 'int64',
    },
  },
} as const satisfies FormRulesValue;

const NUMBER_FIELDS = ['kind', 'kinds', 'note', 'quantity', 'volume'];

const validWarehouse = (overrides: TestValues = {}): TestValues => ({
  address: '',
  boardNodeId: BOARD_NODE_ID,
  capabilities: [1],
  cityId: CITY_ID,
  name: 'Склад «Север»',
  timeZone: 'Europe/Moscow',
  ...overrides,
});

const validNumbers = (overrides: TestValues = {}): TestValues => ({
  kind: '1',
  kinds: ['1'],
  note: 'x',
  quantity: '5',
  volume: '10',
  ...overrides,
});

const resolveWarehouse = async (values: TestValues): Promise<ResolverResult<TestValues>> => createContractResolver<TestValues>(
  CreateWarehouseRequestFormRules,
  WAREHOUSE_FIELDS,
)(values, undefined, OPTIONS);

const resolveNumbers = async (values: TestValues): Promise<ResolverResult<TestValues>> => createContractResolver<TestValues>(
  NUMBER_RULES,
  NUMBER_FIELDS,
)(values, undefined, OPTIONS);

describe('createContractResolver', () => {
  describe('violations', () => {
    it('reports a rule id for every field that breaks the rules and returns no values', async () => {
      const result = await resolveWarehouse(validWarehouse({
        address: 'a'.repeat(501),
        boardNodeId: 'node',
        cityId: '',
        name: '',
        timeZone: 'Moscow',
      }));

      expect(result.values).toEqual({});
      expect(result.errors).toEqual({
        address: { type: 'string.max_len' },
        boardNodeId: { type: 'string.uuid' },
        cityId: { type: 'string.uuid_empty' },
        name: { type: 'string.min_len' },
        timeZone: { type: 'string.pattern' },
      });
    });

    it('keeps the first rule id when a field breaks several rules', async () => {
      const result = await resolveWarehouse(validWarehouse({ capabilities: [0, 0] }));

      expect(result.errors).toEqual({ capabilities: { type: 'repeated.unique' } });
    });

    it('does not check a field that is not in the list of form fields', async () => {
      const result = await createContractResolver<TestValues>(CreateWarehouseRequestFormRules, ['name'])(
        { idempotencyKey: '', name: 'Склад' },
        undefined,
        OPTIONS,
      );

      expect(result.errors).toEqual({});
    });
  });

  describe('valid values', () => {
    it('returns the values without errors', async () => {
      const values = validWarehouse();

      const result = await resolveWarehouse(values);

      expect(result.errors).toEqual({});
      expect(result.values).toEqual(values);
    });

    it('does not change the values it was given', async () => {
      const values = validNumbers({ note: '', quantity: ' 7 ' });
      const snapshot = structuredClone(values);

      await resolveNumbers(values);

      expect(values).toEqual(snapshot);
    });
  });

  describe('coercion', () => {
    it('turns the text of a whole number into a number', async () => {
      const result = await resolveNumbers(validNumbers({ quantity: ' 7 ' }));

      expect(result.errors).toEqual({});
      expect(result.values).toMatchObject({ quantity: 7 });
    });

    it('turns the text of a 64-bit number into a bigint', async () => {
      const result = await resolveNumbers(validNumbers({ volume: '9007199254740993' }));

      expect(result.values).toMatchObject({ volume: 9007199254740993n });
    });

    it('turns an empty text of a number into an absent value', async () => {
      const result = await resolveNumbers(validNumbers({ quantity: '', volume: '' }));

      expect(result.errors).toEqual({ quantity: { type: 'int32.gte_lte' } });
    });

    it('turns the text of an enum value and of list elements into numbers', async () => {
      const result = await resolveNumbers(validNumbers({ kind: '2', kinds: ['1', '3'] }));

      expect(result.errors).toEqual({});
      expect(result.values).toMatchObject({ kind: 2, kinds: [1, 3] });
    });

    it('checks the number rules after the coercion', async () => {
      const result = await resolveNumbers(validNumbers({ kinds: ['1', '9'], quantity: '11' }));

      expect(result.errors).toEqual({
        kinds: { type: 'int32.lte' },
        quantity: { type: 'int32.gte_lte' },
      });
    });

    it.each(['abc', '1.5', '12px', '1e3'])('reports a text that is not a whole number: %s', async (text) => {
      const result = await resolveNumbers(validNumbers({ quantity: text }));

      expect(result.values).toEqual({});
      expect(result.errors).toEqual({ quantity: { type: 'integer.invalid' } });
    });

    it('reports a list element that is not a whole number', async () => {
      const result = await resolveNumbers(validNumbers({ kinds: ['1', 'x'] }));

      expect(result.errors).toEqual({ kinds: { type: 'integer.invalid' } });
    });

    it('reports a number that is too large for a safe integer', async () => {
      const result = await resolveNumbers(validNumbers({ quantity: '9007199254740993' }));

      expect(result.errors).toEqual({ quantity: { type: 'integer.invalid' } });
    });
  });

  describe('presence', () => {
    it('passes an empty text of a field with presence as an absent value, not as an empty string', async () => {
      const result = await resolveNumbers(validNumbers({ note: '' }));

      expect(result.errors).toEqual({});
      expect(result.values).toHaveProperty('note', undefined);
    });

    it('still checks a filled field with presence', async () => {
      const rules = {
        fields: {
          note: {
            hasPresence: true,
            kind: 'string',
            maxLen: 3,
            protoName: 'note',
          },
        },
      } as const satisfies FormRulesValue;

      const result = await createContractResolver<TestValues>(rules, ['note'])({ note: 'abcd' }, undefined, OPTIONS);

      expect(result.errors).toEqual({ note: { type: 'string.max_len' } });
    });

    it('keeps an empty text of a field without presence', async () => {
      const result = await resolveWarehouse(validWarehouse({ address: '' }));

      expect(result.values).toHaveProperty('address', '');
    });
  });
});
