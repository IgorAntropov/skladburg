import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import {
  describe,
  it,
} from 'vitest';

import { specifierNewlineRule } from './specifier-newline-rule.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

ruleTester.run('specifier-newline', specifierNewlineRule, {
  invalid: [
    {
      code: 'import { extname, basename } from \'node:path\';\n',
      errors: [{ column: 19, line: 1, messageId: 'specifierOnNewLine' }],
      output: 'import { extname,\nbasename } from \'node:path\';\n',
    },
    {
      code: 'import type { Dirent, Stats } from \'node:fs\';\n',
      errors: [{ messageId: 'specifierOnNewLine' }],
      output: 'import type { Dirent,\nStats } from \'node:fs\';\n',
    },
    {
      code: 'import path, { basename, extname } from \'node:path\';\n',
      errors: [{ messageId: 'specifierOnNewLine' }],
      output: 'import path, { basename,\nextname } from \'node:path\';\n',
    },
    {
      code: 'export { basename, extname } from \'node:path\';\n',
      errors: [{ messageId: 'specifierOnNewLine' }],
      output: 'export { basename,\nextname } from \'node:path\';\n',
    },
    {
      code: 'const first = 1;\nconst second = 2;\nexport { first, second };\n',
      errors: [{ line: 3, messageId: 'specifierOnNewLine' }],
      output: 'const first = 1;\nconst second = 2;\nexport { first,\nsecond };\n',
    },
    {
      code: 'import { a, b, c } from \'x\';\n',
      errors: [
        { column: 13, messageId: 'specifierOnNewLine' },
        { column: 16, messageId: 'specifierOnNewLine' },
      ],
      output: 'import { a,\nb,\nc } from \'x\';\n',
    },
    {
      code: 'import { a,\n  b, c } from \'x\';\n',
      errors: [{ line: 2, messageId: 'specifierOnNewLine' }],
      output: 'import { a,\n  b,\nc } from \'x\';\n',
    },
    {
      code: 'import { a as first, b as second } from \'x\';\n',
      errors: [{ messageId: 'specifierOnNewLine' }],
      output: 'import { a as first,\nb as second } from \'x\';\n',
    },
    {
      code: 'import { type A, type B } from \'x\';\n',
      errors: [{ messageId: 'specifierOnNewLine' }],
      output: 'import { type A,\ntype B } from \'x\';\n',
    },
    {
      code: 'import { a, b, } from \'x\';\n',
      errors: [{ messageId: 'specifierOnNewLine' }],
      output: 'import { a,\nb, } from \'x\';\n',
    },
    {
      code: 'import { extname, /* x */ basename } from \'node:path\';\n',
      errors: [{ messageId: 'specifierOnNewLine' }],
      output: null,
    },
    {
      code: 'export { first, /* x */ second };\n',
      errors: [{ messageId: 'specifierOnNewLine' }],
      output: null,
    },
  ],
  valid: [
    'import { basename } from \'node:path\';\n',
    'import {\n  basename,\n  extname,\n} from \'node:path\';\n',
    'import {\n  basename,\n  extname\n} from \'node:path\';\n',
    'import path from \'node:path\';\n',
    'import path, { basename } from \'node:path\';\n',
    'import path, {\n  basename,\n  extname,\n} from \'node:path\';\n',
    'import * as path from \'node:path\';\n',
    'import \'node:path\';\n',
    'import {} from \'x\';\n',
    'import type { Dirent } from \'node:fs\';\n',
    'export * from \'x\';\n',
    'export * as ns from \'x\';\n',
    'export {};\n',
    'export const value = 1;\n',
    'const first = 1;\nconst second = 2;\nexport {\n  first,\n  second,\n};\n',
    'export { basename } from \'node:path\';\n',
    'const options = { first: 1, second: 2 };\n',
    'const { first, second } = { first: 1, second: 2 };\n',
    'const value = [1, 2, 3];\n',
    'function run(first: number, second: number): number {\n  return first + second;\n}\n',
    'import { extname, // x\n  basename } from \'node:path\';\n',
  ],
});
