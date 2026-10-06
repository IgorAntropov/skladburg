import type { ESLint } from 'eslint';

import { noCommentsRule } from './no-comments-rule.ts';
import { noUiStringsRule } from './no-ui-strings-rule.ts';
import { specifierNewlineRule } from './specifier-newline-rule.ts';

export const localPlugin: ESLint.Plugin = {
  rules: {
    'no-comments': noCommentsRule,
    'no-ui-strings': noUiStringsRule,
    'specifier-newline': specifierNewlineRule,
  },
};
