import {
  expect,
  it,
} from 'vitest';

import { readScannedCell } from './readScannedCell';

it('looks up cell codes in context even if the address resembles a GTIN or a unit code', () => {
  const cells = new Map([['four', '000000000000000017'], ['one', '12345678'], ['three', 'WH-A1'], ['two', '12345670']]);
  expect(readScannedCell('12345678', cells)).toBe('one');
  expect(readScannedCell(']C012345670', cells)).toBe('two');
  expect(readScannedCell(']Q1wh-a1', cells)).toBe('three');
  expect(readScannedCell('000000000000000017', cells)).toBe('four');
  expect(readScannedCell(']C100000000000000000017', cells)).toBeUndefined();
  expect(readScannedCell('WH-X', cells)).toBeUndefined();
});
