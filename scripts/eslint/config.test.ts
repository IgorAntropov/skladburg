import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import {
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

const projectDirectory = fileURLToPath(new URL('../..', import.meta.url));
const lintedFilePath = fileURLToPath(new URL('../../eslint.config.ts', import.meta.url));
const applicationFilePath = fileURLToPath(new URL('../../apps/web/src/app/App.tsx', import.meta.url));
const scriptFilePath = fileURLToPath(new URL('./no-ui-strings-rule.ts', import.meta.url));
const applicationScriptFilePath = fileURLToPath(new URL('../../apps/web/src/app/probe-logic.ts', import.meta.url));

const formattingRuleIds: ReadonlySet<string> = new Set([
  '@stylistic/object-curly-newline',
  'local/specifier-newline',
  'perfectionist/sort-exports',
  'perfectionist/sort-imports',
  'perfectionist/sort-named-exports',
  'perfectionist/sort-named-imports',
]);

interface LintOutcomeValue {
  formattingRuleIds: string[];
  output: string | undefined;
  ruleIds: string[];
}

describe('eslint.config.ts with the local rules', () => {
  let checkingEslint: ESLint | undefined;
  let fixingEslint: ESLint | undefined;

  beforeAll(() => {
    checkingEslint = new ESLint({ cwd: projectDirectory });
    fixingEslint = new ESLint({ cwd: projectDirectory, fix: true });
  });

  const lint = async (eslint: ESLint | undefined, code: string, filePath: string = lintedFilePath): Promise<LintOutcomeValue> => {
    if (eslint === undefined) {
      throw new Error('ESLint is not initialized');
    }

    const results = await eslint.lintText(code, { filePath });
    const messages = results.flatMap(result => result.messages);
    const fatalMessages = messages.filter(message => message.fatal === true);

    if (fatalMessages.length > 0) {
      throw new Error(`Probe failed to lint ${filePath}: ${fatalMessages.map(message => message.message).join('; ')}`);
    }

    const ruleIds = messages.flatMap(message => (message.ruleId === null ? [] : [message.ruleId]));

    return {
      formattingRuleIds: ruleIds.filter(ruleId => formattingRuleIds.has(ruleId)),
      output: results.find(result => result.output !== undefined)?.output,
      ruleIds,
    };
  };

  const readRuleSeverity = async (filePath: string, ruleId: string): Promise<unknown> => {
    if (checkingEslint === undefined) {
      throw new Error('ESLint is not initialized');
    }

    const config: unknown = await checkingEslint.calculateConfigForFile(filePath);
    const rules = typeof config === 'object' && config !== null && 'rules' in config ? config.rules : undefined;
    const ruleConfig: unknown = typeof rules === 'object' && rules !== null && ruleId in rules ? Reflect.get(rules, ruleId) : undefined;

    return Array.isArray(ruleConfig) ? ruleConfig[0] : ruleConfig;
  };

  const fixTwice = async (code: string): Promise<{ firstPass: LintOutcomeValue; secondPass: LintOutcomeValue; text: string }> => {
    const firstPass = await lint(fixingEslint, code);
    const text = firstPass.output ?? code;
    const secondPass = await lint(fixingEslint, text);

    return { firstPass, secondPass, text };
  };

  describe('fixing import and export layout', () => {
    it.each([
      [
        'a regular import',
        'import { extname, basename } from \'node:path\';\n',
        'import {\n  basename,\n  extname,\n} from \'node:path\';\n',
      ],
      [
        'an already sorted import',
        'import { basename, extname } from \'node:path\';\n',
        'import {\n  basename,\n  extname,\n} from \'node:path\';\n',
      ],
      [
        'a type import',
        'import type { Stats, Dirent } from \'node:fs\';\n',
        'import type {\n  Dirent,\n  Stats,\n} from \'node:fs\';\n',
      ],
      [
        'a default import with named imports',
        'import path, { extname, basename } from \'node:path\';\n',
        'import path, {\n  basename,\n  extname,\n} from \'node:path\';\n',
      ],
      [
        'a re-export with two names',
        'export { extname, basename } from \'node:path\';\n',
        'export {\n  basename,\n  extname,\n} from \'node:path\';\n',
      ],
      [
        'a local export with two names',
        'const second = 2;\nconst first = 1;\nexport { second, first };\n',
        'const second = 2;\nconst first = 1;\nexport {\n  first,\n  second,\n};\n',
      ],
      [
        'three names',
        'import { join, extname, basename } from \'node:path\';\n',
        'import {\n  basename,\n  extname,\n  join,\n} from \'node:path\';\n',
      ],
      [
        'a multiline import with one name',
        'import {\n  basename,\n} from \'node:path\';\n',
        'import { basename } from \'node:path\';\n',
      ],
      [
        'a multiline import with two names on one line inside the braces',
        'import {\n  extname, basename,\n} from \'node:path\';\n',
        'import {\n  basename,\n  extname,\n} from \'node:path\';\n',
      ],
    ])('converges for %s in one fix run and leaves nothing for the second one', async (_name, code, expected) => {
      const { firstPass, secondPass, text } = await fixTwice(code);

      expect(text).toBe(expected);
      expect(firstPass.formattingRuleIds).toEqual([]);
      expect(secondPass.output).toBeUndefined();
      expect(secondPass.formattingRuleIds).toEqual([]);
    });

    it('reports the unformatted import before the fix', async () => {
      const outcome = await lint(checkingEslint, 'import { extname, basename } from \'node:path\';\n');

      expect(outcome.ruleIds).toContain('local/specifier-newline');
      expect(outcome.ruleIds).toContain('@stylistic/object-curly-newline');
      expect(outcome.ruleIds).toContain('perfectionist/sort-named-imports');
    });

    it('reports a multiline import with one name before the fix', async () => {
      const outcome = await lint(checkingEslint, 'import {\n  basename,\n} from \'node:path\';\n');

      expect(outcome.ruleIds).toContain('@stylistic/object-curly-newline');
    });

    it.each([
      ['a single name in one line', 'import { basename } from \'node:path\';\n'],
      ['two names, one per line, with a trailing comma', 'import {\n  basename,\n  extname,\n} from \'node:path\';\n'],
      ['a default import', 'import path from \'node:path\';\n'],
      ['a namespace import', 'import * as path from \'node:path\';\n'],
      ['an empty export', 'export {};\n'],
      ['an export of everything', 'export * from \'node:path\';\n'],
      ['an export with one name', 'export { basename } from \'node:path\';\n'],
    ])('does not change %s', async (_name, code) => {
      const outcome = await lint(fixingEslint, code);

      expect(outcome.output).toBeUndefined();
      expect(outcome.formattingRuleIds).toEqual([]);
    });

    it('does not break object literals, object patterns and interfaces', async () => {
      const code = [
        'export const options = { alpha: 1, beta: 2 };',
        'export const { alpha, beta } = options;',
        'export interface Pair { alpha: number; beta: number }',
        '',
      ].join('\n');

      const outcome = await lint(fixingEslint, code);

      expect(outcome.output).toBeUndefined();
      expect(outcome.formattingRuleIds).toEqual([]);
    });

    it('keeps a block comment between names and reports it', async () => {
      const code = 'import { extname, /* x */ basename } from \'node:path\';\n';

      const { secondPass, text } = await fixTwice(code);

      expect(text).toContain('/* x */');
      expect(secondPass.ruleIds).toContain('local/no-comments');
    });

    it('keeps a line comment between names and reports it', async () => {
      const code = 'import { extname, // x\n  basename } from \'node:path\';\n';

      const { secondPass, text } = await fixTwice(code);

      expect(text).toContain('// x');
      expect(secondPass.ruleIds).toContain('local/no-comments');
    });

    it('does not remove a comment while converging the layout of a neighbouring import', async () => {
      const code = 'import { extname, basename } from \'node:path\'; // x\n';

      const { text } = await fixTwice(code);

      expect(text).toContain('// x');
    });
  });

  describe('forbidden comments and directives', () => {
    it.each([
      ['a line comment', '// x\nexport const value = 1;\n'],
      ['a block comment', '/* x */\nexport const value = 1;\n'],
      ['a documentation comment', '/**\n * x\n */\nexport const value = 1;\n'],
      ['a disable directive for a block', '/* eslint-disable */\nexport const value = 1;\n'],
      ['a disable directive for the next line', '// eslint-disable-next-line no-console\nexport const value = 1;\n'],
      ['a disable directive for one rule', '/* eslint-disable local/no-comments */\nexport const value = 1;\n'],
      ['a type error suppression', '// @ts-expect-error\nexport const value: number = \'x\';\n'],
      ['a type error ignore directive', '// @ts-ignore\nexport const value: number = \'x\';\n'],
      ['a triple-slash reference', '/// <reference types="node" />\nexport const value = 1;\n'],
    ])('reports %s', async (_name, code) => {
      const outcome = await lint(checkingEslint, code);

      expect(outcome.ruleIds).toContain('local/no-comments');
    });

    it('does not let a disable directive hide the comment report', async () => {
      const outcome = await lint(checkingEslint, '/* eslint-disable local/no-comments */\nexport const value = 1;\n');

      expect(outcome.ruleIds.filter(ruleId => ruleId === 'local/no-comments')).toHaveLength(1);
    });

    it('does not report comment markers inside strings', async () => {
      const outcome = await lint(checkingEslint, 'export const text = \'// x\';\n');

      expect(outcome.ruleIds).not.toContain('local/no-comments');
    });
  });

  describe('ignored files', () => {
    it.each([
      ['a build output directory', 'apps/web/dist/main.ts'],
      ['a root build output directory', 'dist/main.ts'],
      ['a coverage directory', 'coverage/report.ts'],
      ['a turbo cache directory', '.turbo/cache.ts'],
    ])('returns no results for a file in %s when ignored files are not warned about', async (_name, relativePath) => {
      const eslint = new ESLint({ cwd: projectDirectory });

      const results = await eslint.lintText('// x\n', {
        filePath: fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
        warnIgnored: false,
      });

      expect(results).toEqual([]);
    });
  });

  describe('other rules from the configuration', () => {
    it.each([
      ['any', 'export const value: any = 1;\n', '@typescript-eslint/no-explicit-any'],
      [
        'a non-null assertion',
        'const map = new Map<string, number>();\nexport const value = map.get(\'a\')!;\n',
        '@typescript-eslint/no-non-null-assertion',
      ],
      ['a missing return type', 'export function run() {\n  return 1;\n}\n', '@typescript-eslint/explicit-function-return-type'],
      ['a block without braces', 'export const run = (value: boolean): void => {\n  if (value) console.info(value);\n};\n', 'curly'],
    ])('reports %s', async (_name, code, expectedRuleId) => {
      const outcome = await lint(checkingEslint, code);

      expect(outcome.ruleIds).toContain(expectedRuleId);
    });
  });

  describe('interface strings', () => {
    const viewWithText = 'export const View = (): ReactElement => <main>Склад</main>;\n';
    const viewWithAttribute = 'export const View = (): ReactElement => <input placeholder="Поиск" />;\n';

    it.each([
      ['text in JSX', viewWithText],
      ['a user-facing attribute', viewWithAttribute],
    ])('reports %s in a TSX file of the application', async (_name, code) => {
      const outcome = await lint(checkingEslint, code, applicationFilePath);

      expect(outcome.ruleIds).toContain('local/no-ui-strings');
    });

    it.each([
      ['a TSX file of the application', applicationFilePath, true],
      ['a script file', scriptFilePath, false],
      ['a TS file of the application', applicationScriptFilePath, false],
    ])('enables the rule by scope for %s', async (_name, filePath, isEnabled) => {
      const severity = await readRuleSeverity(filePath, 'local/no-ui-strings');
      const isActive = severity === 1 || severity === 2 || severity === 'warn' || severity === 'error';

      expect(isActive).toBe(isEnabled);
    });

    it('does not report a catalog call in a TSX file of the application', async () => {
      const code = 'export const View = (): ReactElement => <main>{t(\'field.placeholder\')}</main>;\n';

      const outcome = await lint(checkingEslint, code, applicationFilePath);

      expect(outcome.ruleIds).not.toContain('local/no-ui-strings');
    });
  });
});
