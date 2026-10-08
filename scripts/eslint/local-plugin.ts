import type { ESLint } from 'eslint';

import { noCommentsRule } from './no-comments-rule.ts';
import { noRawControlsRule } from './no-raw-controls-rule.ts';
import { noUiStringsRule } from './no-ui-strings-rule.ts';
import { specifierNewlineRule } from './specifier-newline-rule.ts';

export const localPlugin: ESLint.Plugin = {
  rules: {
    'no-comments': noCommentsRule,
    'no-raw-controls': noRawControlsRule,
    'no-ui-strings': noUiStringsRule,
    'specifier-newline': specifierNewlineRule,
  },
};
