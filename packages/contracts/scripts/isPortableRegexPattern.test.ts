import {
  describe,
  expect,
  it,
} from 'vitest';

import { isPortableRegexPattern } from './isPortableRegexPattern';

describe('isPortableRegexPattern', () => {
  it.each([
    ['^[a-z]+$'],
    ['^([a-z][a-z0-9_]*)?$'],
    ['^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$'],
    ['^[A-Z]{3}$'],
    ['^(?:ab|cd)+$'],
    ['^\\d{3}-\\w+\\b$'],
    ['^[\\w.-]+@[\\w-]+\\.[a-z]{2,}$'],
    ['\\x41\\t\\n\\r\\f\\v'],
    ['^\\p{L}+$'],
    ['^\\P{Lu}+$'],
    ['\\.\\*\\(\\)\\[\\]\\\\'],
    ['[^a-z\\d]'],
    ['^[а-яё]+$'],
  ])('accepts %s', (source) => {
    expect(isPortableRegexPattern(source)).toBe(true);
  });

  it.each([
    ['(?i)abc', 'inline flag'],
    ['(?s)a', 'inline flag'],
    ['(?m)^a$', 'inline flag'],
    ['(?U)a+', 'inline flag'],
    ['(?i:a)', 'scoped flag group'],
    ['(?P<name>a)', 'RE2 named group'],
    ['(?<name>a)', 'named group'],
    ['(?=a)a', 'lookahead'],
    ['\\Aa', 'RE2 text anchor'],
    ['a\\z', 'RE2 text anchor'],
    ['\\Ca', 'RE2 byte escape'],
    ['\\Qa.b\\E', 'RE2 quoted literal'],
    ['[[:alpha:]]', 'POSIX class'],
    ['[^[:digit:]]', 'POSIX class'],
    ['\\pN', 'one letter property'],
    ['\\PN', 'one letter property'],
    ['\\p{Greek}', 'script name without Script='],
    ['\\x{41}', 'RE2 long hex'],
    ['\\a', 'RE2 bell'],
    ['\\s', 'wider whitespace in JS'],
    ['\\S', 'wider whitespace in JS'],
    ['[\\s]', 'wider whitespace in JS'],
    ['^a.b$', 'dot matches CR in RE2'],
    ['(a)\\1', 'backreference'],
    ['\\0', 'octal'],
    ['[]a]', 'leading bracket in class'],
    ['[^]a]', 'leading bracket in class'],
    ['[\\b]', 'backspace in class'],
    ['\\u0041', 'JS unicode escape'],
    ['a{,2}', 'literal brace in RE2'],
    ['a*+', 'possessive quantifier'],
    ['[a', 'unclosed class'],
    ['(a', 'unclosed group'],
    ['\\', 'trailing backslash'],
  ])('rejects %s (%s)', (source) => {
    expect(isPortableRegexPattern(source)).toBe(false);
  });
});
