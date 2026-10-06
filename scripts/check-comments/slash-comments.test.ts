import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  findCssCommentLines,
  findProtoCommentLines,
  findScriptCommentLines,
} from './slash-comments.ts';

describe('findCssCommentLines', () => {
  it('finds a block comment', () => {
    expect(findCssCommentLines('a { color: red; }\n/* x */\n')).toEqual([2]);
  });

  it('reports the first line of a multiline block comment and counts the lines after it', () => {
    const source = 'a {}\n/* first\nsecond\nthird */\nb {}\n/* later */\n';

    expect(findCssCommentLines(source)).toEqual([2, 6]);
  });

  it('finds an unterminated block comment', () => {
    expect(findCssCommentLines('a {}\n/* never closed\nb {}\n')).toEqual([2]);
  });

  it('ignores a comment marker inside a double-quoted string', () => {
    expect(findCssCommentLines('a::after { content: "/* not a comment */"; }\n')).toEqual([]);
  });

  it('ignores a comment marker inside a single-quoted string', () => {
    expect(findCssCommentLines('a::after { content: \'/* not a comment */\'; }\n')).toEqual([]);
  });

  it('does not treat double slashes as a comment', () => {
    expect(findCssCommentLines('a { background: url(//example.org/a.png); }\n')).toEqual([]);
  });

  it('keeps counting lines after an escaped line break inside a string', () => {
    expect(findCssCommentLines('a::after { content: "x\\\ny"; }\n/* x */\n')).toEqual([3]);
  });

  it('returns nothing for a file without comments', () => {
    expect(findCssCommentLines('a { color: red; }\n')).toEqual([]);
  });
});

describe('findProtoCommentLines', () => {
  it('finds a line comment', () => {
    expect(findProtoCommentLines('message A {}\n// x\n')).toEqual([2]);
  });

  it('finds a trailing line comment', () => {
    expect(findProtoCommentLines('message A {} // x\n')).toEqual([1]);
  });

  it('finds a block comment', () => {
    expect(findProtoCommentLines('/* x */\nmessage A {}\n')).toEqual([1]);
  });

  it('ignores slashes inside a string', () => {
    expect(findProtoCommentLines('string name = 1 [json_name = "a//b"];\n')).toEqual([]);
  });

  it('resets an unterminated string at the end of the line', () => {
    expect(findProtoCommentLines('option a = "broken;\n// x\n')).toEqual([2]);
  });

  it('finds a comment after a line comment on the previous line', () => {
    expect(findProtoCommentLines('// one\n// two\n')).toEqual([1, 2]);
  });

  it('works with CRLF line breaks', () => {
    expect(findProtoCommentLines('message A {}\r\n// x\r\n')).toEqual([2]);
  });
});

describe('findScriptCommentLines', () => {
  it('finds a line comment and a block comment', () => {
    expect(findScriptCommentLines('const a = 1;\n// x\n/* y */\n')).toEqual([2, 3]);
  });

  it('ignores comment markers inside all three kinds of quotes', () => {
    const source = 'const a = "// x";\nconst b = \'/* y */\';\nconst c = `// z`;\n';

    expect(findScriptCommentLines(source)).toEqual([]);
  });

  it('keeps a template literal open across line breaks', () => {
    expect(findScriptCommentLines('const a = `first\n// still text\nlast`;\n// x\n')).toEqual([4]);
  });
});
