import type { FormRulesValue } from '@skladburg/contracts/forms';
import type { ResolverOptions } from 'react-hook-form';

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createContractResolver } from './createContractResolver';

interface OutputValue {
  note: string;
  quantity: bigint;
}

type TestValues = Record<string, unknown>;

const OPTIONS: ResolverOptions<TestValues> = { fields: {}, shouldUseNativeValidation: undefined };

const RULES = {
  fields: {
    note: { kind: 'string', minLen: 1, protoName: 'note' },
    quantity: { kind: 'integer', protoName: 'quantity', type: 'int64' },
  },
} as const satisfies FormRulesValue;

const FIELDS = ['note', 'quantity'];

describe('contract resolver with a check of the values', () => {
  it('passes the coerced values to the check and reports its issues on the fields', async () => {
    const validateValues = vi.fn<(values: OutputValue) => { field: string; ruleId: string }[]>(
      () => [{ field: 'quantity', ruleId: 'quantity.too_small' }],
    );

    const result = await createContractResolver<TestValues, OutputValue>(RULES, FIELDS, { validateValues })(
      { note: 'Партия', quantity: '12' },
      undefined,
      OPTIONS,
    );

    expect(validateValues).toHaveBeenCalledWith({ note: 'Партия', quantity: 12n });
    expect(result.errors).toEqual({ quantity: { type: 'quantity.too_small' } });
    expect(result.values).toEqual({});
  });

  it('returns the values when the check finds nothing', async () => {
    const result = await createContractResolver<TestValues, OutputValue>(RULES, FIELDS, { validateValues: () => [] })(
      { note: 'Партия', quantity: '12' },
      undefined,
      OPTIONS,
    );

    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ note: 'Партия', quantity: 12n });
  });

  it('does not run the check while the rules of the contract are broken', async () => {
    const validateValues = vi.fn<(values: OutputValue) => { field: string; ruleId: string }[]>(() => []);

    const result = await createContractResolver<TestValues, OutputValue>(RULES, FIELDS, { validateValues })(
      { note: '', quantity: '12' },
      undefined,
      OPTIONS,
    );

    expect(validateValues).not.toHaveBeenCalled();
    expect(Object.keys(result.errors)).toEqual(['note']);
  });
});
