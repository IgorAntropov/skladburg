import {
  describe,
  expect,
  it,
} from 'vitest';

import { isOgrnValid } from './isOgrnValid';

describe('isOgrnValid', () => {
  it.each(['1020000123450', '5000000000017', '0000000000121', '0000000000110', '0000000000100'])(
    'accepts the OGRN %s of thirteen digits',
    (value) => {
      expect(isOgrnValid(value)).toBe(true);
    },
  );

  it('accepts the OGRNIP of fifteen digits', () => {
    expect(isOgrnValid('304000012345673')).toBe(true);
  });

  it.each(['1020000123451', '5000000000018', '1020000123350'])('rejects the OGRN %s with one digit changed', (value) => {
    expect(isOgrnValid(value)).toBe(false);
  });

  it.each(['304000012345674', '304000012345573'])('rejects the OGRNIP %s with one digit changed', (value) => {
    expect(isOgrnValid(value)).toBe(false);
  });

  it('checks the check digit by the divisor of its own length', () => {
    expect(isOgrnValid('102000012345')).toBe(false);
    expect(isOgrnValid('10200001234500')).toBe(false);
    expect(isOgrnValid('1020000123450'.replace(/0$/, '3'))).toBe(false);
  });

  it.each(['', '1', '102000012345', '10200001234500', '1020000123450123', '10200001234a0', '1020000123450\n'])(
    'rejects %j by its length or characters',
    (value) => {
      expect(isOgrnValid(value)).toBe(false);
    },
  );
});
