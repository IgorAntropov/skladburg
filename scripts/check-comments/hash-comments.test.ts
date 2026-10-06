import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  findHashLineCommentLines,
  findHashOrSemicolonLineCommentLines,
} from './hash-comments.ts';

describe('findHashLineCommentLines', () => {
  it('finds a line that starts with a hash', () => {
    expect(findHashLineCommentLines('node_modules/\n# x\n')).toEqual([2]);
  });

  it('finds an indented hash line', () => {
    expect(findHashLineCommentLines('  # x\n')).toEqual([1]);
  });

  it('returns nothing for plain entries', () => {
    expect(findHashLineCommentLines('node_modules/\ndist/\n')).toEqual([]);
  });

  it('does not treat a semicolon line as a comment', () => {
    expect(findHashLineCommentLines(';x\n')).toEqual([]);
  });

  it('ignores blank lines', () => {
    expect(findHashLineCommentLines('\n\n  \n')).toEqual([]);
  });

  it('does not treat a hash in the middle of a line as a comment', () => {
    expect(findHashLineCommentLines('KEY=value#tail\n')).toEqual([]);
  });
});

describe('findHashOrSemicolonLineCommentLines', () => {
  it('finds an indented hash line', () => {
    expect(findHashOrSemicolonLineCommentLines('  # x\n')).toEqual([1]);
  });

  it('finds a semicolon line', () => {
    expect(findHashOrSemicolonLineCommentLines('registry=https://example.org/\n; x\n')).toEqual([2]);
  });

  it('returns nothing for settings with a URL', () => {
    expect(findHashOrSemicolonLineCommentLines('registry=https://example.org/\n')).toEqual([]);
  });
});
