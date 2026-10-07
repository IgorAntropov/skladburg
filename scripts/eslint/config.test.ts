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
const applicationIndexFilePath = fileURLToPath(new URL('../../apps/web/src/app/index.ts', import.meta.url));
const engineCoreFilePath = fileURLToPath(new URL('../../packages/demo-engine/src/core/protocol.ts', import.meta.url));
const engineCoreTestFilePath = fileURLToPath(new URL('../../packages/demo-engine/src/core/ports/clock.test.ts', import.meta.url));
const engineEntryFilePath = fileURLToPath(new URL('../../packages/demo-engine/src/index.ts', import.meta.url));

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

  describe('determinism of the engine core', () => {
    const engineCoreRuleIds: readonly string[] = ['no-restricted-globals', 'no-restricted-properties', 'no-restricted-syntax'];

    const forbiddenUsages: readonly (readonly [string, string, string])[] = [
      ['Date.now', 'export const read = (): number => Date.now();\n', 'no-restricted-properties'],
      ['Math.random', 'export const read = (): number => Math.random();\n', 'no-restricted-properties'],
      ['new Date() without arguments', 'export const read = (): Date => new Date();\n', 'no-restricted-syntax'],
      ['Date() called as a function', 'export const read = (): string => Date();\n', 'no-restricted-syntax'],
      ['setTimeout', 'export const run = (): void => {\n  setTimeout(() => 1, 10);\n};\n', 'no-restricted-globals'],
      ['setInterval', 'export const run = (): void => {\n  setInterval(() => 1, 10);\n};\n', 'no-restricted-globals'],
      ['clearTimeout', 'export const run = (id: number): void => {\n  clearTimeout(id);\n};\n', 'no-restricted-globals'],
      ['clearInterval', 'export const run = (id: number): void => {\n  clearInterval(id);\n};\n', 'no-restricted-globals'],
      ['setImmediate', 'export const run = (): void => {\n  setImmediate(() => 1);\n};\n', 'no-restricted-globals'],
      ['clearImmediate', 'export const run = (id: unknown): void => {\n  clearImmediate(id);\n};\n', 'no-restricted-globals'],
      ['requestAnimationFrame', 'export const run = (): void => {\n  requestAnimationFrame(() => 1);\n};\n', 'no-restricted-globals'],
      ['cancelAnimationFrame', 'export const run = (id: number): void => {\n  cancelAnimationFrame(id);\n};\n', 'no-restricted-globals'],
      ['requestIdleCallback', 'export const run = (): void => {\n  requestIdleCallback(() => 1);\n};\n', 'no-restricted-globals'],
      ['cancelIdleCallback', 'export const run = (id: number): void => {\n  cancelIdleCallback(id);\n};\n', 'no-restricted-globals'],
      ['performance', 'export const read = (): number => performance.now();\n', 'no-restricted-globals'],
      ['crypto', 'export const read = (): string => crypto.randomUUID();\n', 'no-restricted-globals'],
      ['indexedDB', 'export const open = (): unknown => indexedDB;\n', 'no-restricted-globals'],
      ['navigator', 'export const read = (): unknown => navigator;\n', 'no-restricted-globals'],
      ['self', 'export const read = (): unknown => self;\n', 'no-restricted-globals'],
      ['window', 'export const read = (): unknown => window;\n', 'no-restricted-globals'],
      ['document', 'export const read = (): unknown => document;\n', 'no-restricted-globals'],
      ['globalThis', 'export const read = (): unknown => globalThis;\n', 'no-restricted-globals'],
      ['fetch', 'export const read = (): unknown => fetch(\'https://example.test\');\n', 'no-restricted-globals'],
      ['postMessage', 'export const run = (): void => {\n  postMessage(\'x\', []);\n};\n', 'no-restricted-globals'],
      ['addEventListener', 'export const run = (): void => {\n  addEventListener(\'m\', () => 1);\n};\n', 'no-restricted-globals'],
      ['removeEventListener', 'export const run = (): void => {\n  removeEventListener(\'m\', () => 1);\n};\n', 'no-restricted-globals'],
      ['close', 'export const run = (): void => {\n  close();\n};\n', 'no-restricted-globals'],
      ['importScripts', 'export const read = (): unknown => importScripts;\n', 'no-restricted-globals'],
      ['onmessage', 'export const read = (): unknown => onmessage;\n', 'no-restricted-globals'],
      ['location', 'export const read = (): unknown => location.href;\n', 'no-restricted-globals'],
      ['BroadcastChannel', 'export const open = (): unknown => new BroadcastChannel(\'x\');\n', 'no-restricted-globals'],
      ['MessageChannel', 'export const open = (): unknown => new MessageChannel();\n', 'no-restricted-globals'],
      ['WebSocket', 'export const open = (): unknown => new WebSocket(\'wss://example.test\');\n', 'no-restricted-globals'],
      ['Worker', 'export const open = (): unknown => new Worker(\'x\');\n', 'no-restricted-globals'],
      ['XMLHttpRequest', 'export const open = (): unknown => new XMLHttpRequest();\n', 'no-restricted-globals'],
      ['caches', 'export const read = (): unknown => caches;\n', 'no-restricted-globals'],
      ['localStorage', 'export const read = (): unknown => localStorage;\n', 'no-restricted-globals'],
      ['sessionStorage', 'export const read = (): unknown => sessionStorage;\n', 'no-restricted-globals'],
      ['process', 'export const read = (): unknown => process.env;\n', 'no-restricted-globals'],
    ];

    it.each(forbiddenUsages)('reports %s in a source file of the core', async (_name, code, expectedRuleId) => {
      const outcome = await lint(checkingEslint, code, engineCoreFilePath);

      expect(outcome.ruleIds).toContain(expectedRuleId);
    });

    it.each(forbiddenUsages)('reports %s in a test file of the core', async (_name, code, expectedRuleId) => {
      const outcome = await lint(checkingEslint, code, engineCoreTestFilePath);

      expect(outcome.ruleIds).toContain(expectedRuleId);
    });

    it.each(forbiddenUsages)('does not report %s in a file outside of the core', async (_name, code) => {
      const engineEntryOutcome = await lint(checkingEslint, code, engineEntryFilePath);
      const applicationOutcome = await lint(checkingEslint, code, applicationIndexFilePath);

      expect(engineEntryOutcome.ruleIds.filter(ruleId => engineCoreRuleIds.includes(ruleId))).toEqual([]);
      expect(applicationOutcome.ruleIds.filter(ruleId => engineCoreRuleIds.includes(ruleId))).toEqual([]);
    });

    it.each([
      ['new Date with an explicit timestamp', 'export const read = (timestamp: number): Date => new Date(timestamp);\n'],
      ['new Date with zero', 'export const read = (): Date => new Date(0);\n'],
      ['a property named now on another object', 'export const read = (clock: { now: () => number }): number => clock.now();\n'],
      ['a property named random on another object', 'export const read = (source: { random: number }): number => source.random;\n'],
      ['a local variable named performance', 'export const read = (performance: number): number => performance + 1;\n'],
      ['queueMicrotask', 'export const run = (): void => {\n  queueMicrotask(() => 1);\n};\n'],
      ['a local variable named self', 'export const read = (self: number): number => self + 1;\n'],
      ['structuredClone', 'export const copy = (value: object): object => structuredClone(value);\n'],
      ['console', 'export const run = (): void => {\n  console.log(1);\n};\n'],
      ['Headers', 'export const read = (): unknown => new Headers();\n'],
      ['Request', 'export const read = (): unknown => new Request(\'https://example.test\');\n'],
      ['Response', 'export const read = (): unknown => new Response(null);\n'],
      ['URL', 'export const read = (): unknown => new URL(\'https://example.test\');\n'],
      ['TextDecoder', 'export const read = (): unknown => new TextDecoder();\n'],
      ['TextEncoder', 'export const read = (): unknown => new TextEncoder();\n'],
    ])('does not report %s in a file of the core', async (_name, code) => {
      const outcome = await lint(checkingEslint, code, engineCoreFilePath);

      expect(outcome.ruleIds.filter(ruleId => engineCoreRuleIds.includes(ruleId))).toEqual([]);
    });
  });
});
