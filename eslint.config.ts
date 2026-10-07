import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import perfectionist from 'eslint-plugin-perfectionist';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

import { localPlugin } from './scripts/eslint/local-plugin.ts';

const scriptFiles: string[] = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'];
const plainScriptFiles: string[] = ['**/*.{js,jsx,mjs,cjs}'];

export default defineConfig(
  {
    ignores: ['**/dist/', '**/coverage/', '**/.turbo/', 'packages/contracts/src/gen/'],
  },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: scriptFiles,
    plugins: {
      local: localPlugin,
    },
    rules: {
      'local/no-comments': 'error',
      'local/specifier-newline': 'error',
    },
  },
  {
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      stylistic.configs.customize({
        braceStyle: 'stroustrup',
        commaDangle: 'always-multiline',
        indent: 2,
        quotes: 'single',
        semi: true,
      }),
      perfectionist.configs['recommended-natural'],
    ],
    files: scriptFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/max-len': ['error', { code: 140 }],
      '@stylistic/member-delimiter-style': 'error',
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
      '@stylistic/object-curly-newline': [
        'error',
        {
          ExportDeclaration: { minProperties: 2, multiline: true },
          ImportDeclaration: { minProperties: 2, multiline: true },
          ObjectExpression: { consistent: true },
          ObjectPattern: { consistent: true },
          TSEnumBody: { consistent: true },
          TSInterfaceBody: { consistent: true },
          TSTypeLiteral: { consistent: true },
        },
      ],
      '@stylistic/type-annotation-spacing': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'curly': ['error', 'all'],
      'no-param-reassign': ['error', { props: false }],
      'perfectionist/sort-imports': [
        'error',
        { internalPattern: ['^@/.+'] },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    rules: {
      'local/no-ui-strings': 'error',
    },
  },
  {
    extends: [reactHooks.configs.flat.recommended],
    files: ['apps/web/**/*.{ts,tsx}'],
  },
  {
    extends: [tseslint.configs.disableTypeChecked],
    files: plainScriptFiles,
  },
);
