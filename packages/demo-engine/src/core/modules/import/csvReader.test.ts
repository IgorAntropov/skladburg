import {
  describe,
  expect,
  it,
} from 'vitest';

import { readCsv } from './csvReader';

describe('readCsv', () => {
  it('preserves quoted delimiters, CRLF and embedded newlines', () => {
    expect(readCsv(new TextEncoder().encode('\uFEFFname;sku\r\n"Молоко;""А""\nБ";0001\r\n'))).toEqual([
      ['name', 'sku'], ['Молоко;"А"\nБ', '0001'],
    ]);
  });
  it('decodes Windows 1251', () => {
    expect(readCsv(new Uint8Array([0xed, 0xe0, 0xe8, 0xec, 0xe5, 0xed, 0xee, 0xe2, 0xe0, 0xed, 0xe8, 0xe5, 59, 115]))).toEqual([
      ['наименование', 's'],
    ]);
  });
  it.each(['a,b\n"x', 'a,b\n"x"z,y', 'a,b\nx"z,y'])('rejects malformed CSV %s', (source) => {
    expect(() => readCsv(new TextEncoder().encode(source))).toThrow();
  });
  it('rejects cell, row and column limits before growing output', () => {
    expect(() => readCsv(new TextEncoder().encode('x'.repeat(4097)))).toThrow();
    expect(() => readCsv(new TextEncoder().encode(Array.from({ length: 33 }, () => 'a').join(',')))).toThrow();
    expect(() => readCsv(new TextEncoder().encode('a\n'.repeat(10002)))).toThrow();
  });
});
