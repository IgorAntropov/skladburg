import {
  describe,
  expect,
  it,
} from 'vitest';

import { findYamlCommentLines } from './yaml-comments.ts';

describe('findYamlCommentLines', () => {
  it.each([
    ['a comment on its own line', '# x\na: 1\n', [1]],
    ['an indented comment', 'a:\n  # x\n  b: 1\n', [2]],
    ['a comment after a value', 'key: value # x\n', [1]],
    ['a comment after an escaped quote in a single-quoted string', 'title: \'it\'\'s\' # x\n', [1]],
    ['a comment after an empty single-quoted string', 'a: \'\' # x\n', [1]],
    ['a comment after a plain scalar with an apostrophe', 't: it\'s # x\n', [1]],
    ['a comment after a double-quoted string with an escaped quote', 'a: "say \\"hi\\"" # x\n', [1]],
    ['a comment inside a flow sequence line', 'items: [a, b] # x\n', [1]],
    ['several comments', '# one\na: 1 # two\n# three\n', [1, 2, 3]],
  ])('finds %s', (_name, source, expectedLines) => {
    expect(findYamlCommentLines(source)).toEqual(expectedLines);
  });

  it.each([
    ['a hash inside a URL', 'url: https://example.org/a#b\n'],
    ['a hash inside a single-quoted string', 'title: \'a # b\'\n'],
    ['a hash inside a double-quoted string', 'title: "a # b"\n'],
    ['a hash after an escaped quote inside a single-quoted string', 'title: \'it\'\'s # x\'\n'],
    ['an empty single-quoted string', 'b: \'\'\n'],
    ['a hash that is glued to the word before it', 'a: value#b\n'],
    ['a hash inside a quoted sequence item', '- \'a # b\'\n'],
    ['a document without comments', 'a: 1\nb:\n  - c\n  - d\n'],
  ])('finds nothing for %s', (_name, source) => {
    expect(findYamlCommentLines(source)).toEqual([]);
  });

  it('works with CRLF line breaks', () => {
    expect(findYamlCommentLines('a: 1\r\n# x\r\n')).toEqual([2]);
  });

  describe('block scalars', () => {
    it.each([
      ['a literal scalar', 'script: |\n  echo 1 # not a comment\n  # not a comment\nnext: 1\n'],
      ['a folded scalar', 'text: >\n  words # not a comment\nnext: 1\n'],
      ['a literal scalar that keeps trailing line breaks', 'script: |+\n  echo # x\nnext: 1\n'],
      ['a folded scalar that strips trailing line breaks', 'text: >-\n  words # x\nnext: 1\n'],
      ['a literal scalar with an indentation indicator', 'script: |2\n    echo # x\nnext: 1\n'],
      ['a scalar with the modifier before the indentation indicator', 'script: |-2\n    echo # x\nnext: 1\n'],
      ['a scalar with the indentation indicator before the modifier', 'script: |2-\n    echo # x\nnext: 1\n'],
      ['a scalar that contains blank lines', 'script: |\n  one # x\n\n  two # y\nnext: 1\n'],
      ['a scalar of a sequence item', 'steps:\n  - |\n    echo # x\n  - next\n'],
      ['a scalar of a key inside a sequence item', 'steps:\n  - run: |\n      echo # x\n    name: build\n'],
      ['a scalar that ends the document', 'script: |\n  echo # x\n'],
    ])('does not look inside %s', (_name, source) => {
      expect(findYamlCommentLines(source)).toEqual([]);
    });

    it('finds a comment on the line of the indicator', () => {
      expect(findYamlCommentLines('key: | # x\n  body # not a comment\n')).toEqual([1]);
    });

    it('finds a comment on the line of a folded indicator with a modifier', () => {
      expect(findYamlCommentLines('key: >- # x\n  body\n')).toEqual([1]);
    });

    it('finds a comment on the line right after the scalar ends', () => {
      expect(findYamlCommentLines('key: |\n  body # not a comment\n# x\nnext: 1\n')).toEqual([3]);
    });

    it('finds a comment on a key line that follows the scalar', () => {
      expect(findYamlCommentLines('key: |\n  body\nnext: 1 # x\n')).toEqual([3]);
    });

    it('finds a comment on a sibling key of a sequence item after the scalar', () => {
      expect(findYamlCommentLines('steps:\n  - run: |\n      echo\n    name: build # x\n')).toEqual([4]);
    });

    it('does not start a scalar from a quoted value that looks like an indicator', () => {
      expect(findYamlCommentLines('key: \'|\'\n  # x\n')).toEqual([2]);
    });

    it('does not start a scalar from a plain value that ends with an angle bracket', () => {
      expect(findYamlCommentLines('key: a>\n  # x\n')).toEqual([2]);
    });

    it('ends the scalar of a nested key at the next key of the parent', () => {
      expect(findYamlCommentLines('a:\n  b: |\n    body # not a comment\n  c: 1 # x\n')).toEqual([4]);
    });
  });
});
