import type { ESLint } from 'eslint';

import { noCommentsRule } from './no-comments-rule.ts';
import { specifierNewlineRule } from './specifier-newline-rule.ts';

export const localPlugin: ESLint.Plugin = {
  rules: {
    'no-comments': noCommentsRule,
    'specifier-newline': specifierNewlineRule,
  },
};
