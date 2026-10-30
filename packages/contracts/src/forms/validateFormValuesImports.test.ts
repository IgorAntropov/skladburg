import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

const SOURCE_PATH = join(import.meta.dirname, 'validateFormValues.ts');
const VALUE_IMPORT_PATTERN = /^(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s*['"]([^'"]+)['"]/gm;
const SIDE_EFFECT_IMPORT_PATTERN = /^import\s+['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const CHECKS_SPECIFIER_PATTERN = /(^|\/)checks(\/|$)/;

const readValueSpecifiers = (source: string): string[] =>
  [VALUE_IMPORT_PATTERN, SIDE_EFFECT_IMPORT_PATTERN, DYNAMIC_IMPORT_PATTERN].flatMap(pattern =>
    [...source.matchAll(pattern)].flatMap(match => (match[1] === undefined ? [] : [match[1]])));

describe('validateFormValues imports', () => {
  it('reads value imports and skips type imports', () => {
    const source = [
      'import type { A } from \'./checks/types\';',
      'import {',
      '  b,',
      '  c,',
      '} from \'./checks/runFieldCheck\';',
      'import { d } from \'./getFormField\';',
      'export { e } from \'./checks/isInnValid\';',
      'export type { F } from \'./checks/fieldCheckKinds\';',
      'import \'./checks/effect\';',
      'const g = import(\'./checks/lazy\');',
      '',
    ].join('\n');

    expect(readValueSpecifiers(source).toSorted()).toEqual([
      './checks/effect',
      './checks/isInnValid',
      './checks/lazy',
      './checks/runFieldCheck',
      './getFormField',
    ]);
  });

  it('keeps the check functions out of the bundle of every form by importing nothing from checks by value', () => {
    const specifiers = readValueSpecifiers(readFileSync(SOURCE_PATH, 'utf8'));

    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter(specifier => CHECKS_SPECIFIER_PATTERN.test(specifier))).toEqual([]);
  });
});
