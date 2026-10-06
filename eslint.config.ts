import type { Rule } from 'eslint';

import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import perfectionist from 'eslint-plugin-perfectionist';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const noCommentsRule: Rule.RuleModule = {
  create: (context: Rule.RuleContext): Rule.RuleListener => ({
    Program: (): void => {
      for (const comment of context.sourceCode.getAllComments()) {
        if (comment.loc) {
          context.report({ loc: comment.loc, messageId: 'commentForbidden' });
        }
      }
    },
  }),
  meta: {
    messages: {
      commentForbidden: 'Comments are forbidden',
    },
    schema: [],
    type: 'problem',
  },
};

type SpecifierHostNode
  = | Parameters<NonNullable<Rule.RuleListener['ExportNamedDeclaration']>>[0]
    | Parameters<NonNullable<Rule.RuleListener['ImportDeclaration']>>[0];

const specifierNewlineRule: Rule.RuleModule = {
  create: (context: Rule.RuleContext): Rule.RuleListener => {
    const checkSpecifiers = (node: SpecifierHostNode): void => {
      const namedSpecifiers = node.specifiers.filter(
        specifier => specifier.type === 'ImportSpecifier' || specifier.type === 'ExportSpecifier',
      );

      namedSpecifiers.forEach((specifier, index) => {
        const previous = namedSpecifiers[index - 1];

        if (!previous || previous.loc?.end.line !== specifier.loc?.start.line) {
          return;
        }

        const comma = context.sourceCode.getTokenAfter(previous);

        context.report({
          fix: (fixer: Rule.RuleFixer): null | Rule.Fix => {
            if (comma?.value !== ',' || context.sourceCode.commentsExistBetween(comma, specifier)) {
              return null;
            }

            return fixer.replaceTextRange([comma.range[1], specifier.range?.[0] ?? comma.range[1]], '\n');
          },
          messageId: 'specifierOnNewLine',
          node: specifier,
        });
      });
    };

    return {
      ExportNamedDeclaration: checkSpecifiers,
      ImportDeclaration: checkSpecifiers,
    };
  },
  meta: {
    fixable: 'whitespace',
    messages: {
      specifierOnNewLine: 'Each named specifier must be on its own line',
    },
    schema: [],
    type: 'layout',
  },
};

const scriptFiles: string[] = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'];
const plainScriptFiles: string[] = ['**/*.{js,jsx,mjs,cjs}'];

export default defineConfig(
  {
    ignores: ['**/dist/', '**/coverage/', '**/.turbo/'],
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
      local: {
        rules: {
          'no-comments': noCommentsRule,
          'specifier-newline': specifierNewlineRule,
        },
      },
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
    extends: [tseslint.configs.disableTypeChecked],
    files: plainScriptFiles,
  },
);
