import {
  describe,
  expect,
  it,
} from 'vitest';

import { findMarkupCommentLines } from './markup-comments.ts';

describe('findMarkupCommentLines', () => {
  describe('markup comments', () => {
    it('finds a comment', () => {
      expect(findMarkupCommentLines('<div></div>\n<!-- x -->\n')).toEqual([2]);
    });

    it('finds a comment in an svg document', () => {
      expect(findMarkupCommentLines('<svg>\n<!-- x -->\n</svg>\n')).toEqual([2]);
    });

    it('finds a comment after an element on the same line', () => {
      expect(findMarkupCommentLines('<div></div> <!-- x -->\n')).toEqual([1]);
    });

    it('reports a line once when it has several comments', () => {
      expect(findMarkupCommentLines('<!-- a --><!-- b -->\n')).toEqual([1]);
    });

    it('returns nothing for a document without comments', () => {
      expect(findMarkupCommentLines('<!doctype html>\n<html lang="ru"></html>\n')).toEqual([]);
    });
  });

  describe('style elements', () => {
    it('finds a comment inside a style element with its absolute line number', () => {
      const source = '<html>\n<head>\n<style>\n  a { color: red; }\n  /* x */\n</style>\n</head>\n</html>\n';

      expect(findMarkupCommentLines(source)).toEqual([5]);
    });

    it('finds a comment on the same line as the opening tag', () => {
      expect(findMarkupCommentLines('<p></p>\n<style>/* x */ a {}</style>\n')).toEqual([2]);
    });

    it('counts every line of a multiline block comment from its first line', () => {
      const source = '<style>\na {}\n/* first\nsecond */\nb {}\n/* later */\n</style>\n';

      expect(findMarkupCommentLines(source)).toEqual([3, 6]);
    });

    it('works with style attributes', () => {
      expect(findMarkupCommentLines('<style type="text/css" media=\'all\'>\n/* x */\n</style>\n')).toEqual([2]);
    });

    it('works with an uppercase tag name', () => {
      expect(findMarkupCommentLines('<STYLE>\n/* x */\n</STYLE>\n')).toEqual([2]);
    });

    it('ignores a comment marker inside a CSS string', () => {
      expect(findMarkupCommentLines('<style>\na::after { content: "/* x */"; }\n</style>\n')).toEqual([]);
    });

    it('does not treat double slashes inside CSS as a comment', () => {
      expect(findMarkupCommentLines('<style>\na { background: url(//example.org/a.png); }\n</style>\n')).toEqual([]);
    });

    it('finds comments in several style elements', () => {
      const source = '<style>\n/* a */\n</style>\n<p></p>\n<style>\n/* b */\n</style>\n';

      expect(findMarkupCommentLines(source)).toEqual([2, 6]);
    });

    it('finds a comment inside a style element of an svg document', () => {
      expect(findMarkupCommentLines('<svg>\n<style>\n/* x */\n</style>\n</svg>\n')).toEqual([3]);
    });

    it('returns nothing for a style element without comments', () => {
      expect(findMarkupCommentLines('<style>\na { color: red; }\n</style>\n')).toEqual([]);
    });
  });

  describe('script elements', () => {
    it('finds a line comment inside a script element with its absolute line number', () => {
      const source = '<html>\n<body>\n<script>\n  const a = 1;\n  // x\n</script>\n</body>\n</html>\n';

      expect(findMarkupCommentLines(source)).toEqual([5]);
    });

    it('finds a block comment inside a script element', () => {
      expect(findMarkupCommentLines('<p></p>\n<script>\n/* x */\n</script>\n')).toEqual([3]);
    });

    it('finds a trailing line comment', () => {
      expect(findMarkupCommentLines('<script>\nconst a = 1; // x\n</script>\n')).toEqual([2]);
    });

    it('finds a comment on the same line as the opening tag', () => {
      expect(findMarkupCommentLines('<p></p>\n<script>// x\n</script>\n')).toEqual([2]);
    });

    it('works with script attributes', () => {
      expect(findMarkupCommentLines('<script type="module" async>\n// x\n</script>\n')).toEqual([2]);
    });

    it('ignores comment markers inside all three kinds of quotes', () => {
      const source = '<script>\nconst a = "// x";\nconst b = \'/* y */\';\nconst c = `// z`;\n</script>\n';

      expect(findMarkupCommentLines(source)).toEqual([]);
    });

    it('keeps a template literal open across line breaks', () => {
      expect(findMarkupCommentLines('<script>\nconst a = `first\n// text\nlast`;\n// x\n</script>\n')).toEqual([5]);
    });

    it('ignores a script element without content', () => {
      expect(findMarkupCommentLines('<script src="/main.js"></script>\n<p></p>\n')).toEqual([]);
    });

    it('ignores a module script element with a URL attribute that contains slashes', () => {
      expect(findMarkupCommentLines('<script type="module" src="//cdn.example.org/a.js"></script>\n')).toEqual([]);
    });

    it('does not let an empty script element swallow the text after it', () => {
      expect(findMarkupCommentLines('<script src="/a.js"></script>\n<p>// text</p>\n<script>\n// x\n</script>\n')).toEqual([4]);
    });

    it('returns nothing for a script element without comments', () => {
      expect(findMarkupCommentLines('<script>\nconst a = 1;\n</script>\n')).toEqual([]);
    });
  });

  describe('mixed content', () => {
    it('merges markup, style and script findings in line order', () => {
      const source = '<!-- a -->\n<style>\n/* b */\n</style>\n<script>\n// c\n</script>\n';

      expect(findMarkupCommentLines(source)).toEqual([1, 3, 6]);
    });

    it('reports a line once when it is found by two rules', () => {
      expect(findMarkupCommentLines('<script>\n// <!-- x\n</script>\n')).toEqual([2]);
    });

    it('works with CRLF line breaks', () => {
      expect(findMarkupCommentLines('<style>\r\na {}\r\n/* x */\r\n</style>\r\n')).toEqual([3]);
    });

    it('does not treat a self-closing style element as a block', () => {
      expect(findMarkupCommentLines('<svg>\n<style/>\n<text>/* not css */</text>\n<style>\n/* x */\n</style>\n</svg>\n')).toEqual([5]);
    });
  });
});
