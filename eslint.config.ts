import type { Linter } from 'eslint';

import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import perfectionist from 'eslint-plugin-perfectionist';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

import { localPlugin } from './scripts/eslint/local-plugin.ts';

const scriptFiles: string[] = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'];
const plainScriptFiles: string[] = ['**/*.{js,jsx,mjs,cjs}'];
const engineCoreFiles: string[] = ['packages/demo-engine/src/core/**/*.ts'];
const engineBoundaryFiles: string[] = ['apps/web/src/**/*.{ts,tsx}'];
const engineBoundaryTestFiles: string[] = ['apps/web/src/**/*.test.{ts,tsx}'];
const engineBoundaryAllowedFiles: string[] = ['apps/web/src/shared/api/transport/demo/**'];
const engineBoundaryMessage = 'The demo engine is reachable only through shared/api/transport/demo; take engine types from there';

const createEngineBoundaryRules = (importPattern: string, selectorPattern: string): Linter.RulesRecord => ({
  'no-restricted-imports': ['error', { patterns: [{ message: engineBoundaryMessage, regex: importPattern }] }],
  'no-restricted-syntax': [
    'error',
    { message: engineBoundaryMessage, selector: `ImportExpression[source.value=/${selectorPattern}/]` },
    { message: engineBoundaryMessage, selector: `TSImportType[argument.literal.value=/${selectorPattern}/]` },
  ],
});

const engineCoreRestrictedGlobals: string[] = [
  'addEventListener',
  'BroadcastChannel',
  'caches',
  'cancelAnimationFrame',
  'cancelIdleCallback',
  'clearImmediate',
  'clearInterval',
  'clearTimeout',
  'close',
  'crypto',
  'document',
  'fetch',
  'globalThis',
  'importScripts',
  'indexedDB',
  'localStorage',
  'location',
  'MessageChannel',
  'navigator',
  'onmessage',
  'performance',
  'postMessage',
  'process',
  'removeEventListener',
  'requestAnimationFrame',
  'requestIdleCallback',
  'self',
  'sessionStorage',
  'setImmediate',
  'setInterval',
  'setTimeout',
  'WebSocket',
  'window',
  'Worker',
  'XMLHttpRequest',
];

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
    files: engineCoreFiles,
    rules: {
      'no-restricted-globals': [
        'error',
        ...engineCoreRestrictedGlobals.map(name => ({
          message: `The engine core must not touch ${name} directly; take it through a port`,
          name,
        })),
      ],
      'no-restricted-properties': [
        'error',
        { message: 'Read the time through IClock', object: 'Date', property: 'now' },
        { message: 'Draw numbers through IRandom', object: 'Math', property: 'random' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          message: 'Read the time through IClock; new Date() needs an explicit argument',
          selector: 'NewExpression[callee.name=\'Date\'][arguments.length=0]',
        },
        {
          message: 'Read the time through IClock; Date() returns the current time',
          selector: 'CallExpression[callee.name=\'Date\']',
        },
      ],
    },
  },
  {
    files: engineBoundaryFiles,
    rules: createEngineBoundaryRules('^@skladburg/demo-engine(/|$)', '^@skladburg.demo-engine($|[^-a-z0-9_])'),
  },
  {
    files: engineBoundaryTestFiles,
    rules: createEngineBoundaryRules(
      '^@skladburg/demo-engine(?!/testing$)(/|$)',
      '^@skladburg.demo-engine($|[^-a-z0-9_](?!testing$))',
    ),
  },
  {
    files: engineBoundaryAllowedFiles,
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    extends: [tseslint.configs.disableTypeChecked],
    files: plainScriptFiles,
  },
);
