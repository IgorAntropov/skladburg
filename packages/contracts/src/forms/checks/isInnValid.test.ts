import {
  describe,
  expect,
  it,
} from 'vitest';

import { isInnValid } from './isInnValid';

describe('isInnValid', () => {
  it.each(['0000000018', '0012345673', '1000000002', '0000060000'])('accepts the ten-digit INN %s', (value) => {
    expect(isInnValid(value)).toBe(true);
  });

  it.each(['001234567887', '000000000184'])('accepts the twelve-digit INN %s', (value) => {
    expect(isInnValid(value)).toBe(true);
  });

  it.each(['0000000019', '0012345674', '1012345673', '0000000108'])('rejects the ten-digit INN %s with one digit changed', (value) => {
    expect(isInnValid(value)).toBe(false);
  });

  it.each(['001234567897', '001234567880', '001334567887', '000000000185', '000000000194'])(
    'rejects the twelve-digit INN %s with one digit changed',
    (value) => {
      expect(isInnValid(value)).toBe(false);
    },
  );

  it.each(['', '0', '000000001', '00000000180', '0000000018000', '0012345678870'])('rejects %j by its length', (value) => {
    expect(isInnValid(value)).toBe(false);
  });

  it.each(['00000000a8', '0000 00018', '0000000018\n', ' 0000000018', '٠٠٠٠٠٠٠٠١٨'])(
    'rejects %j with characters other than digits',
    (value) => {
      expect(isInnValid(value)).toBe(false);
    },
  );
});
