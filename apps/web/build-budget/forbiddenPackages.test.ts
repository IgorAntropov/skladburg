import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  BudgetChunkValue,
  InitialBundleValue,
} from './bundleBudgetTypes.ts';

import {
  assertValidForbiddenPackages,
  createForbiddenPackageMatcher,
  findForbiddenPackagesInChunks,
  findForbiddenPackageViolations,
} from './forbiddenPackages.ts';

describe('assertValidForbiddenPackages', () => {
  it('accepts an empty list, exact names and scope wildcards', () => {
    expect(() => {
      assertValidForbiddenPackages([]);
    }).not.toThrow();
    expect(() => {
      assertValidForbiddenPackages(['three', 'motion-dom', '@tanstack/*', '@scope/name']);
    }).not.toThrow();
  });

  it('rejects an empty or blank pattern', () => {
    expect(() => {
      assertValidForbiddenPackages(['']);
    }).toThrow('got ""');
    expect(() => {
      assertValidForbiddenPackages(['  ']);
    }).toThrow('exact package name');
  });

  it('rejects a wildcard without a scope', () => {
    expect(() => {
      assertValidForbiddenPackages(['*']);
    }).toThrow('got "*"');
    expect(() => {
      assertValidForbiddenPackages(['/*']);
    }).toThrow('got "/*"');
    expect(() => {
      assertValidForbiddenPackages(['@/*']);
    }).toThrow('got "@/*"');
    expect(() => {
      assertValidForbiddenPackages(['tanstack/*']);
    }).toThrow('got "tanstack/*"');
  });

  it('rejects a wildcard inside a name', () => {
    expect(() => {
      assertValidForbiddenPackages(['react-*']);
    }).toThrow('got "react-*"');
    expect(() => {
      assertValidForbiddenPackages(['@scope/*/x']);
    }).toThrow('exact package name');
  });
});

describe('createForbiddenPackageMatcher', () => {
  it('matches an exact name only', () => {
    const isForbidden = createForbiddenPackageMatcher(['three']);

    expect(isForbidden('three')).toBe(true);
    expect(isForbidden('three-stdlib')).toBe(false);
    expect(isForbidden('@types/three')).toBe(false);
  });

  it('matches every package of a scope', () => {
    const isForbidden = createForbiddenPackageMatcher(['@tanstack/*']);

    expect(isForbidden('@tanstack/query-core')).toBe(true);
    expect(isForbidden('@tanstack/react-query')).toBe(true);
    expect(isForbidden('@tanstack-foo/x')).toBe(false);
    expect(isForbidden('tanstack')).toBe(false);
  });

  it('matches nothing for an empty list', () => {
    expect(createForbiddenPackageMatcher([])('three')).toBe(false);
  });
});

describe('findForbiddenPackageViolations', () => {
  const initialBundle: InitialBundleValue = {
    chunks: [
      { fileName: 'index.js', gzipBytes: 1 },
      { fileName: 'vendor.js', gzipBytes: 1 },
    ],
    entryFileName: 'index.js',
    gzipBytes: 2,
  };

  it('lists each package once per chunk', () => {
    const violations = findForbiddenPackageViolations(
      initialBundle,
      new Map([
        ['index.js', ['/n/node_modules/three/a.js', '/n/node_modules/three/b.js', '/n/node_modules/react/index.js']],
        ['vendor.js', ['/n/node_modules/three/c.js']],
      ]),
      createForbiddenPackageMatcher(['three']),
    );

    expect(violations).toEqual([
      { chunkFileName: 'index.js', entryFileName: 'index.js', packageName: 'three' },
      { chunkFileName: 'vendor.js', entryFileName: 'index.js', packageName: 'three' },
    ]);
  });

  it('skips chunks without module ids', () => {
    expect(
      findForbiddenPackageViolations(initialBundle, new Map(), createForbiddenPackageMatcher(['three'])),
    ).toEqual([]);
  });
});

describe('findForbiddenPackagesInChunks', () => {
  const createChunk = (fileName: string, moduleIds: string[]): BudgetChunkValue => ({
    fileName,
    gzipBytes: 1,
    imports: [],
    isDynamicEntry: false,
    isEntry: false,
    moduleIds,
  });

  it('finds a package in an entry, a shared chunk and a lazy chunk alike', () => {
    const violations = findForbiddenPackagesInChunks(
      [
        { ...createChunk('index.js', ['/n/node_modules/stats-gl/a.js']), isEntry: true },
        createChunk('shared.js', ['/n/node_modules/stats-gl/b.js']),
        { ...createChunk('scene.js', ['/n/node_modules/stats.js/src/Stats.js']), isDynamicEntry: true },
      ],
      createForbiddenPackageMatcher(['stats-gl', 'stats.js']),
    );

    expect(violations).toEqual([
      { chunkFileName: 'index.js', packageName: 'stats-gl' },
      { chunkFileName: 'shared.js', packageName: 'stats-gl' },
      { chunkFileName: 'scene.js', packageName: 'stats.js' },
    ]);
  });

  it('lists each package once per chunk and ignores other packages', () => {
    const violations = findForbiddenPackagesInChunks(
      [createChunk('scene.js', ['/n/node_modules/stats-gl/a.js', '/n/node_modules/stats-gl/b.js', '/n/node_modules/three/c.js'])],
      createForbiddenPackageMatcher(['stats-gl']),
    );

    expect(violations).toEqual([{ chunkFileName: 'scene.js', packageName: 'stats-gl' }]);
  });

  it('finds nothing for an empty list', () => {
    expect(
      findForbiddenPackagesInChunks([createChunk('scene.js', ['/n/node_modules/stats-gl/a.js'])], createForbiddenPackageMatcher([])),
    ).toEqual([]);
  });
});
