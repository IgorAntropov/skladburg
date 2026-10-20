import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  dirname,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

const SOURCE_DIRECTORY = resolve(import.meta.dirname, '..');
const FORMS_DIRECTORY = join(SOURCE_DIRECTORY, 'forms');
const GENERATED_FORMS_DIRECTORY = join(SOURCE_DIRECTORY, 'gen', 'forms');
const ALLOWED_DIRECTORIES: readonly string[] = [FORMS_DIRECTORY, GENERATED_FORMS_DIRECTORY];
const RESOLVABLE_SUFFIXES: readonly string[] = ['', '.ts', '.js', '/index.ts', '/index.js'];
const SPECIFIER_PATTERNS: readonly RegExp[] = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s+['"]([^'"]+)['"]/g,
];

const listSourceFiles = (directory: string): string[] => {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);

    if (statSync(path).isDirectory()) {
      return listSourceFiles(path);
    }

    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
};

const readSpecifiers = (file: string): string[] => {
  const source = readFileSync(file, 'utf8');

  return SPECIFIER_PATTERNS.flatMap(pattern =>
    [...source.matchAll(pattern)].flatMap(match => (match[1] === undefined ? [] : [match[1]])));
};

const resolveRelative = (file: string, specifier: string): string | undefined => {
  const base = resolve(dirname(file), specifier);

  return RESOLVABLE_SUFFIXES.map(suffix => `${base}${suffix}`).find(candidate =>
    existsSync(candidate) && statSync(candidate).isFile());
};

const isInsideDirectories = (path: string, directories: readonly string[]): boolean =>
  directories.some(directory => path.startsWith(`${directory}${sep}`));

const toRepositoryPath = (path: string): string => relative(SOURCE_DIRECTORY, path).split(sep).join('/');

const collectBoundaryViolations = (
  entries: readonly string[],
  allowedDirectories: readonly string[],
): string[] => {
  const violations: string[] = [];
  const visited = new Set<string>();
  const queue = [...entries];

  while (queue.length > 0) {
    const file = queue.pop();

    if (file === undefined || visited.has(file)) {
      continue;
    }

    visited.add(file);

    for (const specifier of readSpecifiers(file)) {
      const label = `${toRepositoryPath(file)} imports ${specifier}`;

      if (!specifier.startsWith('.')) {
        violations.push(label);
        continue;
      }

      const target = resolveRelative(file, specifier);

      if (target === undefined || !isInsideDirectories(target, allowedDirectories)) {
        violations.push(label);
        continue;
      }

      queue.push(target);
    }
  }

  return violations;
};

describe('forms import boundary', () => {
  const formsFiles = listSourceFiles(FORMS_DIRECTORY);
  const generatedFiles = listSourceFiles(GENERATED_FORMS_DIRECTORY);

  it('has the engine free functions and the generated tables to check', () => {
    expect(formsFiles.length).toBeGreaterThan(0);
    expect(generatedFiles.length).toBeGreaterThan(0);
    expect(generatedFiles.map(toRepositoryPath)).toContain('gen/forms/organization/v1/organization_rules.ts');
  });

  it('keeps the forms sources on relative imports inside src/forms and src/gen/forms', () => {
    expect(collectBoundaryViolations(formsFiles, ALLOWED_DIRECTORIES)).toEqual([]);
  });

  it('keeps the generated tables away from the registry, the image, protobuf and protovalidate', () => {
    expect(collectBoundaryViolations(generatedFiles, ALLOWED_DIRECTORIES)).toEqual([]);
  });

  it('reports packages, paths outside the allowed directories, dynamic imports and unresolved files', () => {
    const root = mkdtempSync(join(tmpdir(), 'forms-boundary-'));

    try {
      const allowed = join(root, 'allowed');
      const outside = join(root, 'outside');

      mkdirSync(join(allowed, 'nested'), { recursive: true });
      mkdirSync(outside);
      writeFileSync(join(outside, 'registry.ts'), 'export const registry = 1;\n');
      writeFileSync(join(allowed, 'entry.ts'), [
        'import type { A } from \'./nested/index\';',
        'import { b } from \'@bufbuild/protovalidate\';',
        'export { c } from \'../outside/registry\';',
        'const d = import(\'@bufbuild/protobuf\');',
        'import \'./missing\';',
        '',
      ].join('\n'));
      writeFileSync(join(allowed, 'nested', 'index.ts'), 'import { e } from \'../../outside/registry\';\n');

      expect(collectBoundaryViolations([join(allowed, 'entry.ts')], [allowed]).toSorted()).toEqual([
        `${relative(SOURCE_DIRECTORY, join(allowed, 'entry.ts')).split(sep).join('/')} imports ../outside/registry`,
        `${relative(SOURCE_DIRECTORY, join(allowed, 'entry.ts')).split(sep).join('/')} imports ./missing`,
        `${relative(SOURCE_DIRECTORY, join(allowed, 'entry.ts')).split(sep).join('/')} imports @bufbuild/protobuf`,
        `${relative(SOURCE_DIRECTORY, join(allowed, 'entry.ts')).split(sep).join('/')} imports @bufbuild/protovalidate`,
        `${relative(SOURCE_DIRECTORY, join(allowed, 'nested', 'index.ts')).split(sep).join('/')} imports ../../outside/registry`,
      ].toSorted());
    }
    finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('accepts a chain of relative imports inside the allowed directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'forms-boundary-'));

    try {
      writeFileSync(join(root, 'entry.ts'), 'import type { A } from \'./types\';\nexport { b } from \'./b.ts\';\n');
      writeFileSync(join(root, 'types.ts'), 'export type A = string;\n');
      writeFileSync(join(root, 'b.ts'), 'export const b = 1;\n');

      expect(collectBoundaryViolations([join(root, 'entry.ts')], [root])).toEqual([]);
    }
    finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
