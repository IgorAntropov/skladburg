import { fromJson } from '@bufbuild/protobuf';
import {
  ErrorCode,
  ErrorCodeSchema,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getErrorMessageKey } from './getErrorMessageKey';

const declaredCodes = Object.values(ErrorCode)
  .filter((value): value is ErrorCode => typeof value === 'number' && value !== ErrorCode.UNSPECIFIED);

const unknownCode = fromJson(ErrorDetailSchema, { code: 999 }).code;

describe('getErrorMessageKey', () => {
  it('covers every code the contract declares except the unspecified one', () => {
    const schemaNames = ErrorCodeSchema.values
      .map(value => value.localName)
      .filter(name => name !== ErrorCode[ErrorCode.UNSPECIFIED]);

    expect(declaredCodes).toHaveLength(11);
    expect(declaredCodes.map(code => ErrorCode[code]).toSorted()).toEqual(schemaNames.toSorted());
  });

  it.each(declaredCodes.map(code => [ErrorCode[code], code] as const))('maps %s to its own error key', (name, code) => {
    expect(getErrorMessageKey(code)).toBe(`error.${name.toLowerCase()}`);
  });

  it('gives every code a different key', () => {
    const keys = new Set(declaredCodes.map(code => getErrorMessageKey(code)));

    expect(keys.size).toBe(declaredCodes.length);
  });

  it('falls back to the internal error text for the unspecified code', () => {
    expect(getErrorMessageKey(ErrorCode.UNSPECIFIED)).toBe('error.internal');
  });

  it('falls back to the internal error text for a code the client does not know', () => {
    expect(getErrorMessageKey(unknownCode)).toBe('error.internal');
  });
});
