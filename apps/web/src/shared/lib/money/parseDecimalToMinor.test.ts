import {
  describe,
  expect,
  it,
} from 'vitest';

import { parseDecimalToMinor } from './parseDecimalToMinor';

describe('parseDecimalToMinor', () => {
  it.each([
    ['1 234,5', 100n, 123450n],
    ['1234.50', 100n, 123450n],
    ['0,07', 100n, 7n],
    ['89', 100n, 8900n],
    ['89,', 100n, 8900n],
    [',5', 100n, 50n],
    ['12\u00a0345,67', 100n, 1234567n],
    ['12\u202f345,67', 100n, 1234567n],
    ['  7 ', 100n, 700n],
    ['480,5', 1000n, 480500n],
    ['480', 1n, 480n],
    ['0', 100n, 0n],
    ['00012,50', 100n, 1250n],
    ['92233720368547758,07', 100n, 9223372036854775807n],
  ])('reads "%s" with the scale %s as %s', (text, scale, expected) => {
    expect(parseDecimalToMinor(text, scale)).toBe(expected);
  });

  it.each([
    ['an empty text', ''],
    ['only spaces', ' \u00a0 '],
    ['only a separator', ','],
    ['only a point', '.'],
    ['more fraction digits than the scale', '1,234'],
    ['trailing zeros beyond the scale', '1,500'],
    ['a minus sign', '-5'],
    ['a plus sign', '+5'],
    ['two separators', '1,2,3'],
    ['a point and a comma', '1.234,50'],
    ['letters', '12a'],
    ['a currency sign', '12 ₽'],
    ['an exponent', '1e3'],
  ])('rejects %s', (_, text) => {
    expect(parseDecimalToMinor(text, 100n)).toBeUndefined();
  });

  it('rejects a fraction when the scale has no fraction digits', () => {
    expect(parseDecimalToMinor('5,5', 1n)).toBeUndefined();
    expect(parseDecimalToMinor('5.0', 1n)).toBeUndefined();
  });

  it('rejects a scale that is not a power of ten', () => {
    expect(parseDecimalToMinor('5', 0n)).toBeUndefined();
    expect(parseDecimalToMinor('5', 250n)).toBeUndefined();
    expect(parseDecimalToMinor('5', -100n)).toBeUndefined();
  });

  it('keeps every digit above the safe integer range', () => {
    expect(parseDecimalToMinor('50 000 000 000 000 000,01', 100n)).toBe(5000000000000000001n);
  });
});
