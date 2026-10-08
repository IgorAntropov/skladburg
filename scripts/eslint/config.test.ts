import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
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
const pageFilePath = fileURLToPath(new URL('../../apps/web/src/pages/probe-logic.ts', import.meta.url));
const pageTestFilePath = fileURLToPath(new URL('../../apps/web/src/pages/probe-logic.test.ts', import.meta.url));
const pageComponentTestFilePath = fileURLToPath(new URL('../../apps/web/src/pages/probe-view.test.tsx', import.meta.url));
const apiClientFilePath = fileURLToPath(new URL('../../apps/web/src/shared/api/client/probe-client.ts', import.meta.url));
const apiClientTestFilePath = fileURLToPath(new URL('../../apps/web/src/shared/api/client/probe-client.test.ts', import.meta.url));
const demoTransportFilePath = fileURLToPath(new URL('../../apps/web/src/shared/api/transport/demo/probe-transport.ts', import.meta.url));
const demoTransportTestFilePath = fileURLToPath(
  new URL('../../apps/web/src/shared/api/transport/demo/probe-transport.test.ts', import.meta.url),
);
const i18nFilePath = fileURLToPath(new URL('../../apps/web/src/shared/i18n/translation/probe-format.ts', import.meta.url));
const i18nTestFilePath = fileURLToPath(new URL('../../apps/web/src/shared/i18n/translation/probe-format.test.ts', import.meta.url));
const bootstrapFilePath = fileURLToPath(new URL('../../apps/web/src/app/bootstrap/probe-start.ts', import.meta.url));
const bootstrapTestFilePath = fileURLToPath(new URL('../../apps/web/src/app/bootstrap/probe-start.test.ts', import.meta.url));
const engineWorkerFilePath = fileURLToPath(new URL('../../packages/demo-engine/src/worker/probe-host.ts', import.meta.url));
const scriptsProbeFilePath = fileURLToPath(new URL('./probe-tool.ts', import.meta.url));

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
  let untypedEslint: ESLint | undefined;

  beforeAll(() => {
    checkingEslint = new ESLint({ cwd: projectDirectory });
    untypedEslint = new ESLint({ cwd: projectDirectory, overrideConfig: [tseslint.configs.disableTypeChecked] });
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

  const toValueImport = (specifier: string): string => `import { probe } from '${specifier}';\nexport const value = probe;\n`;
  const toTypeImport = (specifier: string): string => `import type { Probe } from '${specifier}';\nexport type Value = Probe;\n`;
  const toDynamicImport = (specifier: string): string => `export const load = (): Promise<unknown> => import('${specifier}');\n`;
  const toReExport = (specifier: string): string => `export { probe } from '${specifier}';\n`;
  const toTypeQuery = (specifier: string): string => `export type Value = import('${specifier}').Probe;\n`;

  const importForms: readonly (readonly [string, (specifier: string) => string])[] = [
    ['a value import', toValueImport],
    ['a type import', toTypeImport],
    ['a dynamic import', toDynamicImport],
    ['a re-export', toReExport],
    ['an import type query', toTypeQuery],
  ];

  const isRestricted = (ruleIds: readonly string[]): boolean =>
    ruleIds.includes('no-restricted-imports') || ruleIds.includes('no-restricted-syntax');

  describe('boundary of the demo engine in the web application', () => {
    const engineEntries: readonly (readonly [string, string])[] = [
      ['the package entry', '@skladburg/demo-engine'],
      ['the client entry', '@skladburg/demo-engine/client'],
      ['the worker entry', '@skladburg/demo-engine/worker?worker'],
      ['the testing entry', '@skladburg/demo-engine/testing'],
      ['a nested path', '@skladburg/demo-engine/client/types'],
    ];

    describe.each(importForms)('with %s', (_formName, toCode) => {
      it.each(engineEntries)('reports %s in a page', async (_name, specifier) => {
        const outcome = await lint(untypedEslint, toCode(specifier), pageFilePath);

        expect(isRestricted(outcome.ruleIds)).toBe(true);
      });

      it.each(engineEntries)('reports %s in the client of the api layer', async (_name, specifier) => {
        const outcome = await lint(untypedEslint, toCode(specifier), apiClientFilePath);

        expect(isRestricted(outcome.ruleIds)).toBe(true);
      });

      it.each(engineEntries)('allows %s in the demo transport', async (_name, specifier) => {
        const outcome = await lint(untypedEslint, toCode(specifier), demoTransportFilePath);

        expect(isRestricted(outcome.ruleIds)).toBe(false);
      });

      it.each(engineEntries)('allows %s in a test of the demo transport', async (_name, specifier) => {
        const outcome = await lint(untypedEslint, toCode(specifier), demoTransportTestFilePath);

        expect(isRestricted(outcome.ruleIds)).toBe(false);
      });
    });

    it.each([
      ['a test of a page', pageTestFilePath],
      ['a component test of a page', pageComponentTestFilePath],
      ['a test of the api client', apiClientTestFilePath],
    ])('allows the testing entry in %s', async (_name, filePath) => {
      const outcome = await lint(untypedEslint, toValueImport('@skladburg/demo-engine/testing'), filePath);

      expect(isRestricted(outcome.ruleIds)).toBe(false);
    });

    it.each([
      ['a test of a page', pageTestFilePath],
      ['a component test of a page', pageComponentTestFilePath],
      ['a test of the api client', apiClientTestFilePath],
    ])('reports the other entries of the engine in %s', async (_name, filePath) => {
      const forbiddenSpecifiers = [
        '@skladburg/demo-engine',
        '@skladburg/demo-engine/client',
        '@skladburg/demo-engine/worker?worker',
        '@skladburg/demo-engine/testing/engine',
      ];

      for (const specifier of forbiddenSpecifiers) {
        const outcome = await lint(untypedEslint, toValueImport(specifier), filePath);

        expect(isRestricted(outcome.ruleIds), specifier).toBe(true);
      }
    });

    it.each([
      ['a relative module', './demo-engine'],
      ['another workspace package', '@skladburg/contracts'],
      ['a package with a similar name', '@skladburg/demo-engine-tools'],
    ])('does not report %s in a page', async (_name, specifier) => {
      const outcome = await lint(untypedEslint, toValueImport(specifier), pageFilePath);

      expect(isRestricted(outcome.ruleIds)).toBe(false);
    });

    it('does not apply to the engine package itself', async () => {
      const outcome = await lint(untypedEslint, toValueImport('@skladburg/demo-engine/client'), engineEntryFilePath);

      expect(isRestricted(outcome.ruleIds)).toBe(false);
    });

    it.each([
      ['a static import', toValueImport],
      ['a dynamic import', toDynamicImport],
    ])('explains where to take the engine from for %s', async (_name, toCode) => {
      if (untypedEslint === undefined) {
        throw new Error('ESLint is not initialized');
      }

      const [result] = await untypedEslint.lintText(toCode('@skladburg/demo-engine/client'), { filePath: pageFilePath });
      const message = result?.messages.find(item => item.ruleId === 'no-restricted-imports' || item.ruleId === 'no-restricted-syntax');

      expect(message?.message).toContain('shared/api/transport/demo');
    });
  });

  describe('boundary of the testing entry of shared/api in the web application', () => {
    const testingEntrySpecifier = '@/shared/api/index.testing';

    describe.each(importForms)('with %s', (_formName, toCode) => {
      it.each([
        ['a page', pageFilePath],
        ['the client of the api layer', apiClientFilePath],
        ['the demo transport', demoTransportFilePath],
      ])('reports the testing entry in %s', async (_name, filePath) => {
        const outcome = await lint(untypedEslint, toCode(testingEntrySpecifier), filePath);

        expect(isRestricted(outcome.ruleIds)).toBe(true);
      });

      it.each([
        ['a test of a page', pageTestFilePath],
        ['a component test of a page', pageComponentTestFilePath],
        ['a test of the api client', apiClientTestFilePath],
        ['a test of the demo transport', demoTransportTestFilePath],
      ])('allows the testing entry in %s', async (_name, filePath) => {
        const outcome = await lint(untypedEslint, toCode(testingEntrySpecifier), filePath);

        expect(isRestricted(outcome.ruleIds)).toBe(false);
      });
    });

    it.each([
      ['a page', pageFilePath],
      ['a test of a page', pageTestFilePath],
      ['the client of the api layer', apiClientFilePath],
    ])('does not report the public entry of shared/api in %s', async (_name, filePath) => {
      const outcome = await lint(untypedEslint, toValueImport('@/shared/api'), filePath);

      expect(isRestricted(outcome.ruleIds)).toBe(false);
    });

    it.each([
      ['a sibling module', '@/shared/api/index.testing-tools'],
      ['a nested path', '@/shared/api/react/testing/createTestRuntime'],
      ['another slice', '@/shared/i18n/index.testing'],
    ])('does not report %s in a page', async (_name, specifier) => {
      const outcome = await lint(untypedEslint, toValueImport(specifier), pageFilePath);

      expect(isRestricted(outcome.ruleIds)).toBe(false);
    });

    it.each([
      ['a static import', toValueImport],
      ['a dynamic import', toDynamicImport],
      ['an import type query', toTypeQuery],
    ])('explains that the testing entry is for tests for %s', async (_name, toCode) => {
      if (untypedEslint === undefined) {
        throw new Error('ESLint is not initialized');
      }

      const [result] = await untypedEslint.lintText(toCode(testingEntrySpecifier), { filePath: pageFilePath });
      const message = result?.messages.find(item => item.ruleId === 'no-restricted-imports' || item.ruleId === 'no-restricted-syntax');

      expect(message?.message).toContain('for tests only');
    });

    it('keeps the engine boundary in a page next to the testing entry rule', async () => {
      const code = `${toValueImport(testingEntrySpecifier)}${toValueImport('@skladburg/demo-engine/client')}`;
      const outcome = await lint(untypedEslint, code, pageFilePath);

      expect(outcome.ruleIds.filter(ruleId => ruleId === 'no-restricted-imports')).toHaveLength(2);
    });

    it('keeps the engine testing entry allowed in tests and the other entries forbidden', async () => {
      const allowed = await lint(untypedEslint, toValueImport('@skladburg/demo-engine/testing'), pageTestFilePath);
      const forbidden = await lint(untypedEslint, toValueImport('@skladburg/demo-engine/client'), pageTestFilePath);

      expect(isRestricted(allowed.ruleIds)).toBe(false);
      expect(isRestricted(forbidden.ruleIds)).toBe(true);
    });
  });

  describe('device time zone in the engine core and the web application', () => {
    const timeZoneUsages: readonly (readonly [string, string])[] = [
      ['getFullYear', 'export const read = (date: Date): number => date.getFullYear();\n'],
      ['getMonth', 'export const read = (date: Date): number => date.getMonth();\n'],
      ['getDate', 'export const read = (date: Date): number => date.getDate();\n'],
      ['getDay', 'export const read = (date: Date): number => date.getDay();\n'],
      ['getHours', 'export const read = (date: Date): number => date.getHours();\n'],
      ['getMinutes', 'export const read = (date: Date): number => date.getMinutes();\n'],
      ['getSeconds', 'export const read = (date: Date): number => date.getSeconds();\n'],
      ['getMilliseconds', 'export const read = (date: Date): number => date.getMilliseconds();\n'],
      ['getYear', 'export const read = (date: Date): number => date.getYear();\n'],
      ['getTimezoneOffset', 'export const read = (date: Date): number => date.getTimezoneOffset();\n'],
      ['setFullYear', 'export const write = (date: Date): number => date.setFullYear(2026);\n'],
      ['setMonth', 'export const write = (date: Date): number => date.setMonth(1);\n'],
      ['setDate', 'export const write = (date: Date): number => date.setDate(1);\n'],
      ['setHours', 'export const write = (date: Date): number => date.setHours(1);\n'],
      ['setMinutes', 'export const write = (date: Date): number => date.setMinutes(1);\n'],
      ['setSeconds', 'export const write = (date: Date): number => date.setSeconds(1);\n'],
      ['setMilliseconds', 'export const write = (date: Date): number => date.setMilliseconds(1);\n'],
      ['setYear', 'export const write = (date: Date): number => date.setYear(26);\n'],
      ['an optional call of getHours', 'export const read = (date: Date | undefined): number | undefined => date?.getHours();\n'],
      ['a reference to getHours', 'export const read = (): unknown => Date.prototype.getHours;\n'],
      ['toLocaleString', 'export const read = (date: Date): string => date.toLocaleString();\n'],
      ['toLocaleDateString', 'export const read = (date: Date): string => date.toLocaleDateString();\n'],
      ['toLocaleTimeString', 'export const read = (date: Date): string => date.toLocaleTimeString();\n'],
      ['toDateString', 'export const read = (date: Date): string => date.toDateString();\n'],
      ['toTimeString', 'export const read = (date: Date): string => date.toTimeString();\n'],
      ['new Date with two components', 'export const read = (): Date => new Date(2026, 0);\n'],
      ['new Date with three components', 'export const read = (): Date => new Date(2026, 0, 1);\n'],
      ['new Date with a string', 'export const read = (): Date => new Date(\'2026-01-01\');\n'],
      ['new Date with a template string', 'export const read = (day: string): Date => new Date(`2026-01-${day}`);\n'],
      ['Date.parse', 'export const read = (): number => Date.parse(\'2026-01-01\');\n'],
      ['a reference to Date.parse', 'export const read = (): unknown => [\'2026-01-01\'].map(Date.parse);\n'],
      ['new Intl.DateTimeFormat without options', 'export const read = (): unknown => new Intl.DateTimeFormat(\'ru\');\n'],
      ['Intl.DateTimeFormat called without options', 'export const read = (): unknown => Intl.DateTimeFormat(\'ru\');\n'],
      [
        'Intl.DateTimeFormat without a time zone',
        'export const read = (): unknown => new Intl.DateTimeFormat(\'ru\', { hour: \'numeric\' });\n',
      ],
      [
        'Intl.DateTimeFormat with options that are not a literal',
        'export const read = (options: object): unknown => new Intl.DateTimeFormat(\'ru\', options);\n',
      ],
      [
        'Intl.DateTimeFormat with a time zone in a nested call',
        'export const read = (): unknown => new Intl.DateTimeFormat(\'ru\', Object.freeze({ timeZone: \'UTC\' }));\n',
      ],
      ['Temporal.Now', 'export const read = (): unknown => Temporal.Now.instant();\n'],
    ];

    const allowedUsages: readonly (readonly [string, string])[] = [
      ['getUTCHours', 'export const read = (date: Date): number => date.getUTCHours();\n'],
      ['setUTCDate', 'export const write = (date: Date): number => date.setUTCDate(1);\n'],
      ['Date.UTC', 'export const read = (): number => Date.UTC(2026, 0, 1);\n'],
      ['toISOString of a date from a timestamp', 'export const read = (timestamp: number): string => new Date(timestamp).toISOString();\n'],
      ['new Date with zero', 'export const read = (): Date => new Date(0);\n'],
      [
        'Intl.DateTimeFormat with a time zone shorthand',
        'export const read = (timeZone: string): unknown => Intl.DateTimeFormat(\'en-US\', { timeZone });\n',
      ],
      [
        'new Intl.DateTimeFormat with a time zone value',
        'export const read = (): unknown => new Intl.DateTimeFormat(\'ru\', { hour: \'numeric\', timeZone: \'UTC\' });\n',
      ],
      ['new Intl.NumberFormat', 'export const read = (): unknown => new Intl.NumberFormat(\'ru\');\n'],
      ['Intl.NumberFormat called as a function', 'export const read = (): unknown => Intl.NumberFormat(\'ru\');\n'],
      ['the type Intl.DateTimeFormat', 'export type Formatter = Intl.DateTimeFormat;\n'],
    ];

    const readSyntaxRuleIds = (ruleIds: readonly string[]): string[] => ruleIds.filter(ruleId => ruleId === 'no-restricted-syntax');

    describe('in the engine core', () => {
      it.each(timeZoneUsages)('reports %s in a source file of the core', async (_name, code) => {
        const outcome = await lint(untypedEslint, code, engineCoreFilePath);

        expect(readSyntaxRuleIds(outcome.ruleIds)).not.toEqual([]);
      });

      it.each(timeZoneUsages)('reports %s in a test file of the core', async (_name, code) => {
        const outcome = await lint(untypedEslint, code, engineCoreTestFilePath);

        expect(readSyntaxRuleIds(outcome.ruleIds)).not.toEqual([]);
      });

      it.each(timeZoneUsages)('does not report %s outside of the core and the web application', async (_name, code) => {
        const workerOutcome = await lint(untypedEslint, code, engineWorkerFilePath);
        const engineEntryOutcome = await lint(untypedEslint, code, engineEntryFilePath);
        const scriptOutcome = await lint(untypedEslint, code, scriptsProbeFilePath);

        expect(readSyntaxRuleIds(workerOutcome.ruleIds)).toEqual([]);
        expect(readSyntaxRuleIds(engineEntryOutcome.ruleIds)).toEqual([]);
        expect(readSyntaxRuleIds(scriptOutcome.ruleIds)).toEqual([]);
      });

      it.each(allowedUsages)('allows %s in a file of the core', async (_name, code) => {
        const sourceOutcome = await lint(untypedEslint, code, engineCoreFilePath);
        const testOutcome = await lint(untypedEslint, code, engineCoreTestFilePath);

        expect(readSyntaxRuleIds(sourceOutcome.ruleIds)).toEqual([]);
        expect(readSyntaxRuleIds(testOutcome.ruleIds)).toEqual([]);
      });

      it('keeps the older restrictions of the core next to the time zone ones', async () => {
        const code = 'export const read = (date: Date): number => Date.now() + Math.random() + date.getHours() + new Date().getTime();\n';
        const outcome = await lint(untypedEslint, code, engineCoreFilePath);

        expect(outcome.ruleIds.filter(ruleId => ruleId === 'no-restricted-properties')).toHaveLength(2);
        expect(readSyntaxRuleIds(outcome.ruleIds)).toHaveLength(2);
      });

      it('suggests the replacement in the message', async () => {
        if (untypedEslint === undefined) {
          throw new Error('ESLint is not initialized');
        }

        const [result] = await untypedEslint.lintText(timeZoneUsages[0]?.[1] ?? '', { filePath: engineCoreFilePath });
        const message = result?.messages.find(lintMessage => lintMessage.ruleId === 'no-restricted-syntax');

        expect(message?.message).toContain('getUTC*');
        expect(message?.message).toContain('core/calendar');
      });
    });

    describe('in the web application', () => {
      it.each(timeZoneUsages)('reports %s in a page', async (_name, code) => {
        const outcome = await lint(untypedEslint, code, pageFilePath);

        expect(readSyntaxRuleIds(outcome.ruleIds)).not.toEqual([]);
      });

      it.each(timeZoneUsages)('reports %s in a test of a page', async (_name, code) => {
        const outcome = await lint(untypedEslint, code, pageTestFilePath);

        expect(readSyntaxRuleIds(outcome.ruleIds)).not.toEqual([]);
      });

      it.each(timeZoneUsages)('reports %s in the client of the api layer, the demo transport and its test', async (_name, code) => {
        const clientOutcome = await lint(untypedEslint, code, apiClientFilePath);
        const transportOutcome = await lint(untypedEslint, code, demoTransportFilePath);
        const transportTestOutcome = await lint(untypedEslint, code, demoTransportTestFilePath);

        expect(readSyntaxRuleIds(clientOutcome.ruleIds)).not.toEqual([]);
        expect(readSyntaxRuleIds(transportOutcome.ruleIds)).not.toEqual([]);
        expect(readSyntaxRuleIds(transportTestOutcome.ruleIds)).not.toEqual([]);
      });

      it.each(timeZoneUsages)('does not report %s in shared/i18n and app/bootstrap', async (_name, code) => {
        for (const filePath of [i18nFilePath, i18nTestFilePath, bootstrapFilePath, bootstrapTestFilePath]) {
          const outcome = await lint(untypedEslint, code, filePath);

          expect(readSyntaxRuleIds(outcome.ruleIds), filePath).toEqual([]);
        }
      });

      it.each(allowedUsages)('allows %s in a page and in its test', async (_name, code) => {
        const outcome = await lint(untypedEslint, code, pageFilePath);
        const testOutcome = await lint(untypedEslint, code, pageTestFilePath);

        expect(readSyntaxRuleIds(outcome.ruleIds)).toEqual([]);
        expect(readSyntaxRuleIds(testOutcome.ruleIds)).toEqual([]);
      });

      it('suggests formatting through shared/i18n in the message', async () => {
        if (untypedEslint === undefined) {
          throw new Error('ESLint is not initialized');
        }

        const [result] = await untypedEslint.lintText(timeZoneUsages[0]?.[1] ?? '', { filePath: pageFilePath });
        const message = result?.messages.find(lintMessage => lintMessage.ruleId === 'no-restricted-syntax');

        expect(message?.message).toContain('shared/i18n');
      });
    });

    describe('next to the boundary of the demo engine', () => {
      const engineImport = toValueImport('@skladburg/demo-engine/client');
      const engineDynamicImport = toDynamicImport('@skladburg/demo-engine/client');
      const timeZoneCode = 'export const read = (date: Date): number => date.getHours();\n';

      it.each([
        ['a page', pageFilePath],
        ['the client of the api layer', apiClientFilePath],
      ])('reports both the engine import and the time zone in %s', async (_name, filePath) => {
        const outcome = await lint(untypedEslint, `${engineDynamicImport}${timeZoneCode}`, filePath);

        expect(readSyntaxRuleIds(outcome.ruleIds)).toHaveLength(2);
      });

      it.each([
        ['a test of a page', pageTestFilePath],
        ['a test of the api client', apiClientTestFilePath],
      ])('reports both the engine dynamic import and the time zone in %s', async (_name, filePath) => {
        const outcome = await lint(untypedEslint, `${engineDynamicImport}${timeZoneCode}`, filePath);

        expect(readSyntaxRuleIds(outcome.ruleIds)).toHaveLength(2);
      });

      it('reports the engine import and the time zone in a page', async () => {
        const outcome = await lint(untypedEslint, `${engineImport}${timeZoneCode}`, pageFilePath);

        expect(outcome.ruleIds).toContain('no-restricted-imports');
        expect(readSyntaxRuleIds(outcome.ruleIds)).toHaveLength(1);
      });

      it.each([
        ['shared/i18n', i18nFilePath],
        ['app/bootstrap', bootstrapFilePath],
      ])('keeps the engine boundary and drops the time zone in %s', async (_name, filePath) => {
        const staticOutcome = await lint(untypedEslint, `${engineImport}${timeZoneCode}`, filePath);
        const dynamicOutcome = await lint(untypedEslint, `${engineDynamicImport}${timeZoneCode}`, filePath);

        expect(staticOutcome.ruleIds).toContain('no-restricted-imports');
        expect(readSyntaxRuleIds(staticOutcome.ruleIds)).toEqual([]);
        expect(readSyntaxRuleIds(dynamicOutcome.ruleIds)).toHaveLength(1);
      });

      it.each([
        ['a test in shared/i18n', i18nTestFilePath],
        ['a test in app/bootstrap', bootstrapTestFilePath],
      ])('keeps the testing entry allowed and the other entries forbidden in %s', async (_name, filePath) => {
        const allowed = await lint(untypedEslint, toValueImport('@skladburg/demo-engine/testing'), filePath);
        const forbidden = await lint(untypedEslint, toValueImport('@skladburg/demo-engine/client'), filePath);

        expect(isRestricted(allowed.ruleIds)).toBe(false);
        expect(isRestricted(forbidden.ruleIds)).toBe(true);
      });

      it.each([
        ['the demo transport', demoTransportFilePath],
        ['a test of the demo transport', demoTransportTestFilePath],
      ])('keeps the engine allowed and reports the time zone in %s', async (_name, filePath) => {
        const engineOutcome = await lint(untypedEslint, engineDynamicImport, filePath);
        const timeZoneOutcome = await lint(untypedEslint, timeZoneCode, filePath);

        expect(isRestricted(engineOutcome.ruleIds)).toBe(false);
        expect(readSyntaxRuleIds(timeZoneOutcome.ruleIds)).toHaveLength(1);
      });
    });
  });
});
