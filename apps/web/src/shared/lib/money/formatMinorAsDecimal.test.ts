import {
  describe,
  expect,
  it,
} from 'vitest';

import { formatMinorAsDecimal } from './formatMinorAsDecimal';
import { parseDecimalToMinor } from './parseDecimalToMinor';

describe('formatMinorAsDecimal', () => {
  it.each([
    [8950n, 2, '89,50'],
    [5n, 2, '0,05'],
    [0n, 2, '0,00'],
    [480500n, 3, '480,500'],
    [480n, 0, '480'],
    [-8950n, 2, '\u221289,50'],
    [-5n, 2, '\u22120,05'],
    [5000000000000000001n, 2, '50000000000000000,01'],
  ])('writes %s with %s fraction digits as "%s"', (amountMinor, fractionDigits, expected) => {
    expect(formatMinorAsDecimal(amountMinor, fractionDigits)).toBe(expected);
  });

  it('is read back by parseDecimalToMinor', () => {
    const amountMinor = 9223372036854775807n;

    expect(parseDecimalToMinor(formatMinorAsDecimal(amountMinor, 2), 100n)).toBe(amountMinor);
  });
});
