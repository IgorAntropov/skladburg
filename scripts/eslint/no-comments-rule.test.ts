import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import {
  describe,
  it,
} from 'vitest';

import { noCommentsRule } from './no-comments-rule.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

ruleTester.run('no-comments', noCommentsRule, {
  invalid: [
    {
      code: '// x\nconst value = 1;\n',
      errors: [{ column: 1, endColumn: 5, line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: 'const value = 1; // x\n',
      errors: [{ column: 18, line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: '/* x */\nconst value = 1;\n',
      errors: [{ column: 1, endColumn: 8, line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: '/**\n * Description\n */\nconst value = 1;\n',
      errors: [{ column: 1, endColumn: 4, endLine: 3, line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: 'const value = /* x */ 1;\n',
      errors: [{ column: 15, line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: 'const first = 1;\n// one\nconst second = 2;\n// two\n',
      errors: [
        { line: 2, messageId: 'commentForbidden' },
        { line: 4, messageId: 'commentForbidden' },
      ],
    },
    {
      code: '// eslint-disable-next-line no-console\nconsole.log(1);\n',
      errors: [{ line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: '// @ts-expect-error\nconst value: number = \'x\';\n',
      errors: [{ line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: '// @ts-ignore\nconst value: number = \'x\';\n',
      errors: [{ line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: '/// <reference types="vite/client" />\n',
      errors: [{ line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: '// TODO: later\nconst value = 1;\n',
      errors: [{ line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: '// const value = 1;\n',
      errors: [{ line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: 'const value = 1;\n// last line without a line break',
      errors: [{ line: 2, messageId: 'commentForbidden' }],
    },
    {
      code: 'import { a } from \'x\'; // x\n',
      errors: [{ line: 1, messageId: 'commentForbidden' }],
    },
    {
      code: 'const view = <div>{/* x */}</div>;\n',
      errors: [{ line: 1, messageId: 'commentForbidden' }],
      filename: 'view.tsx',
    },
    {
      code: 'type Value = {\n  // x\n  name: string;\n};\n',
      errors: [{ line: 2, messageId: 'commentForbidden' }],
    },
  ],
  valid: [
    'const value = 1;\n',
    '',
    'const text = \'// not a comment\';\n',
    'const text = "/* not a comment */";\n',
    'const text = `// not a comment\n/* still text */`;\n',
    'const pattern = /\\/\\//;\n',
    'const url = \'https://example.org/a\';\n',
    'const value = 1 / 2 / 3;\n',
    {
      code: 'const view = <div>text // not a comment</div>;\n',
      filename: 'view.tsx',
    },
  ],
});
