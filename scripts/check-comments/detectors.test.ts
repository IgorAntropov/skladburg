import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveDetector } from './detectors.ts';

describe('resolveDetector', () => {
  it.each([
    ['styles.css', 'css'],
    ['dir/styles.scss', 'css'],
    ['index.html', 'html'],
    ['logo.svg', 'svg'],
    ['package.json', 'json'],
    ['workflow.yml', 'yaml'],
    ['pnpm-workspace.yaml', 'yaml'],
    ['api.proto', 'proto'],
    ['.gitignore', 'hash-line'],
    ['nested/.gitignore', 'hash-line'],
    ['.nvmrc', 'hash-line'],
    ['.env', 'hash-line'],
    ['.env.example', 'hash-line'],
    ['.env.local', 'hash-line'],
    ['.npmrc', 'hash-or-semicolon-line'],
  ])('selects the %s detector for %s', (filePath, expectedKind) => {
    expect(resolveDetector(filePath)?.kind).toBe(expectedKind);
  });

  it.each([
    'README.md',
    'main.ts',
    'view.tsx',
    'script.js',
    'config.mjs',
    'pnpm-lock.yaml',
    'nested/pnpm-lock.yaml',
    'notes.txt',
    'archive.tar.gz',
    'Makefile',
    '.environment',
  ])('skips %s', (filePath) => {
    expect(resolveDetector(filePath)).toBeUndefined();
  });

  it('selects the detector that finds comments in the matching format', () => {
    expect(resolveDetector('a.css')?.find('/* x */')).toEqual([1]);
    expect(resolveDetector('a.html')?.find('<!-- x -->')).toEqual([1]);
    expect(resolveDetector('a.svg')?.find('<!-- x -->')).toEqual([1]);
    expect(resolveDetector('a.yaml')?.find('# x')).toEqual([1]);
    expect(resolveDetector('a.proto')?.find('// x')).toEqual([1]);
    expect(resolveDetector('a.json')?.find('{ // x\n}')).toHaveLength(1);
    expect(resolveDetector('.env')?.find('# x')).toEqual([1]);
    expect(resolveDetector('.npmrc')?.find('; x')).toEqual([1]);
  });
});
