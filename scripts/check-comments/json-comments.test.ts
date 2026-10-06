import {
  describe,
  expect,
  it,
} from 'vitest';

import { findInvalidJsonLines } from './json-comments.ts';

const byteOrderMark = '\uFEFF';

describe('findInvalidJsonLines', () => {
  it('returns nothing for valid JSON', () => {
    expect(findInvalidJsonLines('{\n  "a": 1\n}\n')).toEqual([]);
  });

  it('returns nothing for valid JSON with a byte order mark', () => {
    expect(findInvalidJsonLines(`${byteOrderMark}{ "a": 1 }`)).toEqual([]);
  });

  it('reports a line comment inside an object', () => {
    expect(findInvalidJsonLines('{ // x\n}')).toHaveLength(1);
  });

  it('reports a line comment after a byte order mark', () => {
    expect(findInvalidJsonLines(`${byteOrderMark}// x\n{}`)).toHaveLength(1);
  });

  it('reports the line of the syntax error when the parser provides it', () => {
    expect(findInvalidJsonLines('{\n  "a": 1,\n  // x\n  "b": 2\n}\n')).toEqual([3]);
  });

  it('falls back to the first line when the error has no line information', () => {
    expect(findInvalidJsonLines('')).toEqual([1]);
  });
});
