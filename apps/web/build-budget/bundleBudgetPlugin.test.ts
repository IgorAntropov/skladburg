import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  BundleBudgetContextValue,
  BundleBudgetOutputValue,
} from './bundleBudgetPlugin.ts';

import { bundleBudgetPlugin } from './bundleBudgetPlugin.ts';
import { gzipSizeInBytes } from './gzipSizeInBytes.ts';

const createNoise = (length: number): string => {
  let seed = 12_345;
  let text = '';

  while (text.length < length) {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    text += seed.toString(36);
  }

  return text.slice(0, length);
};

const createChunk = (
  fileName: string,
  code: string,
  options: { imports?: string[]; isEntry?: boolean; moduleIds?: string[] } = {},
): BundleBudgetOutputValue => ({
  code,
  fileName,
  imports: options.imports ?? [],
  isEntry: options.isEntry ?? false,
  moduleIds: options.moduleIds ?? [],
  type: 'chunk',
});

const createContext = (): BundleBudgetContextValue => ({
  error: (message: string): never => {
    throw new Error(message);
  },
});

const runBudget = (
  maxInitialGzipKiloBytes: number,
  bundle: Record<string, BundleBudgetOutputValue>,
  forbiddenInitialPackages: readonly string[] = [],
): void => {
  bundleBudgetPlugin({ forbiddenInitialPackages, maxInitialGzipKiloBytes }).generateBundle.call(createContext(), {}, bundle);
};

const createRunner = (
  maxInitialGzipKiloBytes: number,
  bundle: Record<string, BundleBudgetOutputValue>,
  forbiddenInitialPackages: readonly string[] = [],
): (() => void) => {
  return () => {
    runBudget(maxInitialGzipKiloBytes, bundle, forbiddenInitialPackages);
  };
};

const createForbiddenRunner = (
  bundle: Record<string, BundleBudgetOutputValue>,
  forbiddenInitialPackages: readonly string[],
): (() => void) => createRunner(100, bundle, forbiddenInitialPackages);

const entryCode = createNoise(2_000);
const entryGzipKiloBytes = gzipSizeInBytes(entryCode) / 1000;

describe('bundleBudgetPlugin', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies only to build', () => {
    expect(bundleBudgetPlugin({ forbiddenInitialPackages: [], maxInitialGzipKiloBytes: 140 }).apply).toBe('build');
  });

  it('rejects a non-positive or non-finite limit', () => {
    expect(() => bundleBudgetPlugin({ forbiddenInitialPackages: [], maxInitialGzipKiloBytes: 0 })).toThrow('positive number');
    expect(() => bundleBudgetPlugin({ forbiddenInitialPackages: [], maxInitialGzipKiloBytes: Number.NaN })).toThrow('positive number');
    expect(() => bundleBudgetPlugin({ forbiddenInitialPackages: [], maxInitialGzipKiloBytes: -1 })).toThrow('positive number');
  });

  it('passes below the limit and logs size and headroom', () => {
    runBudget(entryGzipKiloBytes + 1, { 'index.js': createChunk('index.js', entryCode, { isEntry: true }) });

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      '> bundleBudgetPlugin -> generateBundle:',
      expect.objectContaining({
        entry: 'index.js',
        initialGzipKiloBytes: Number(entryGzipKiloBytes.toFixed(2)),
        limitKiloBytes: Number((entryGzipKiloBytes + 1).toFixed(2)),
      }),
    );
  });

  it('passes exactly at the limit', () => {
    runBudget(entryGzipKiloBytes, { 'index.js': createChunk('index.js', entryCode, { isEntry: true }) });

    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it('fails above the limit with size, limit and chunks', () => {
    const run = createRunner(entryGzipKiloBytes / 2, { 'index.js': createChunk('index.js', entryCode, { isEntry: true }) });

    expect(run).toThrow('Initial JS of entry "index.js"');
    expect(run).toThrow(`${entryGzipKiloBytes.toFixed(2)} kB gzip`);
    expect(run).toThrow(`budget of ${(entryGzipKiloBytes / 2).toFixed(2)} kB`);
    expect(run).toThrow('index.js');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('does not count lazy chunks', () => {
    runBudget(entryGzipKiloBytes + 0.5, {
      'deals.js': createChunk('deals.js', createNoise(50_000)),
      'index.js': createChunk('index.js', entryCode, { isEntry: true }),
    });

    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it('counts a statically imported shared chunk', () => {
    const sharedCode = createNoise(5_000);
    const bundle = {
      'i18n.js': createChunk('i18n.js', sharedCode),
      'index.js': createChunk('index.js', entryCode, { imports: ['i18n.js'], isEntry: true }),
    };

    expect(createRunner(entryGzipKiloBytes + 0.1, bundle)).toThrow('i18n.js');
    expect(createRunner(entryGzipKiloBytes + gzipSizeInBytes(sharedCode) / 1000 + 0.5, bundle)).not.toThrow();
  });

  it('counts a transitive import once in a diamond', () => {
    const sharedCode = createNoise(3_000);
    const sharedKiloBytes = gzipSizeInBytes(sharedCode) / 1000;
    const bundle = {
      'a.js': createChunk('a.js', '', { imports: ['shared.js'] }),
      'b.js': createChunk('b.js', '', { imports: ['shared.js'] }),
      'index.js': createChunk('index.js', entryCode, { imports: ['a.js', 'b.js'], isEntry: true }),
      'shared.js': createChunk('shared.js', sharedCode),
    };

    expect(createRunner(entryGzipKiloBytes + sharedKiloBytes + 0.2, bundle)).not.toThrow();
    expect(createRunner(entryGzipKiloBytes + sharedKiloBytes - 0.01, bundle)).toThrow('shared.js');
  });

  it('does not count assets', () => {
    runBudget(entryGzipKiloBytes + 0.5, {
      'index.css': { type: 'asset' },
      'index.js': createChunk('index.js', entryCode, { isEntry: true }),
    });

    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it('reports every entry separately and names the failing one', () => {
    const adminCode = createNoise(8_000);
    const bundle = {
      'admin.js': createChunk('admin.js', adminCode, { isEntry: true }),
      'main.js': createChunk('main.js', entryCode, { isEntry: true }),
    };

    const run = createRunner(entryGzipKiloBytes + 0.5, bundle);

    expect(run).toThrow('Initial JS of entry "admin.js"');
    expect(run).not.toThrow('entry "main.js"');
  });

  it('logs one line per entry when all pass', () => {
    runBudget(100, {
      'admin.js': createChunk('admin.js', entryCode, { isEntry: true }),
      'main.js': createChunk('main.js', entryCode, { isEntry: true }),
    });

    expect(console.log).toHaveBeenCalledTimes(2);
  });
  it('rejects an invalid forbidden package pattern', () => {
    expect(() => bundleBudgetPlugin({ forbiddenInitialPackages: [''], maxInitialGzipKiloBytes: 90 })).toThrow('exact package name');
    expect(() => bundleBudgetPlugin({ forbiddenInitialPackages: ['*'], maxInitialGzipKiloBytes: 90 })).toThrow('"*"');
    expect(() => bundleBudgetPlugin({ forbiddenInitialPackages: ['/*'], maxInitialGzipKiloBytes: 90 })).toThrow('"/*"');
    expect(() => bundleBudgetPlugin({ forbiddenInitialPackages: ['@tanstack/query-*'], maxInitialGzipKiloBytes: 90 })).toThrow(
      'exact package name',
    );
  });
});

describe('bundleBudgetPlugin forbidden initial packages', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails when a forbidden package is in the entry chunk and names the package, chunk and entry', () => {
    const run = createForbiddenRunner(
      {
        'assets/index.js': createChunk('assets/index.js', entryCode, {
          isEntry: true,
          moduleIds: ['/repo/node_modules/three/build/three.module.js'],
        }),
      },
      ['three'],
    );

    expect(run).toThrow('Package "three"');
    expect(run).toThrow('entry "assets/index.js"');
    expect(run).toThrow('chunk "assets/index.js"');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('fails when a forbidden package is in a statically imported chunk and names that chunk', () => {
    const run = createForbiddenRunner(
      {
        'assets/index.js': createChunk('assets/index.js', entryCode, { imports: ['assets/vendor.js'], isEntry: true }),
        'assets/vendor.js': createChunk('assets/vendor.js', '', {
          moduleIds: ['/repo/node_modules/zustand/esm/index.mjs'],
        }),
      },
      ['zustand'],
    );

    expect(run).toThrow('Package "zustand"');
    expect(run).toThrow('entry "assets/index.js"');
    expect(run).toThrow('chunk "assets/vendor.js"');
  });

  it('passes when the forbidden package is only in a lazy chunk', () => {
    runBudget(
      100,
      {
        'assets/index.js': createChunk('assets/index.js', entryCode, { isEntry: true }),
        'assets/scene.js': createChunk('assets/scene.js', '', {
          moduleIds: ['/repo/node_modules/three/build/three.module.js'],
        }),
      },
      ['three'],
    );

    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it('matches a scope wildcard', () => {
    const bundle = {
      'assets/index.js': createChunk('assets/index.js', entryCode, {
        isEntry: true,
        moduleIds: ['/repo/node_modules/@tanstack/query-core/build/modern/index.js'],
      }),
    };

    expect(createForbiddenRunner(bundle, ['@tanstack/*'])).toThrow('Package "@tanstack/query-core"');
    expect(createForbiddenRunner(bundle, ['@radix-ui/*'])).not.toThrow();
  });

  it('finds a package in the pnpm layout', () => {
    const run = createForbiddenRunner(
      {
        'assets/index.js': createChunk('assets/index.js', entryCode, {
          isEntry: true,
          moduleIds: [
            '/repo/node_modules/.pnpm/@radix-ui+react-slot@1.4.0_react@19.3.0/node_modules/@radix-ui/react-slot/dist/index.mjs',
          ],
        }),
      },
      ['@radix-ui/*'],
    );

    expect(run).toThrow('Package "@radix-ui/react-slot"');
  });

  it('does not match a package with a similar name', () => {
    const bundle = {
      'assets/index.js': createChunk('assets/index.js', entryCode, {
        isEntry: true,
        moduleIds: [
          '/repo/node_modules/three-stdlib/index.js',
          '/repo/node_modules/@tanstack-foo/x/index.js',
          '/repo/node_modules/motion-dom/dist/index.js',
        ],
      }),
    };

    expect(createForbiddenRunner(bundle, ['three', '@tanstack/*', 'motion'])).not.toThrow();
  });

  it('ignores virtual and application modules', () => {
    const bundle = {
      'assets/index.js': createChunk('assets/index.js', entryCode, {
        isEntry: true,
        moduleIds: ['\0vite/preload-helper.js', '/repo/apps/web/src/three/index.ts'],
      }),
    };

    expect(createForbiddenRunner(bundle, ['three'])).not.toThrow();
  });

  it('catches a virtual module that wraps a forbidden package', () => {
    const run = createForbiddenRunner(
      {
        'assets/index.js': createChunk('assets/index.js', entryCode, {
          isEntry: true,
          moduleIds: ['\0/repo/node_modules/zustand/index.js?commonjs-es-import'],
        }),
      },
      ['zustand'],
    );

    expect(run).toThrow('Package "zustand"');
  });

  it('reports every violation in one message', () => {
    const run = createForbiddenRunner(
      {
        'assets/index.js': createChunk('assets/index.js', entryCode, {
          imports: ['assets/vendor.js'],
          isEntry: true,
          moduleIds: [
            '/repo/node_modules/three/build/three.module.js',
            '/repo/node_modules/three/src/core/Object3D.js',
            '/repo/node_modules/@connectrpc/connect/dist/index.js',
          ],
        }),
        'assets/vendor.js': createChunk('assets/vendor.js', '', {
          moduleIds: ['/repo/node_modules/three/build/three.core.js'],
        }),
      },
      ['three', '@connectrpc/*'],
    );

    let message = '';

    try {
      run();
    }
    catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    const lines = message.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Package "three"');
    expect(lines[0]).toContain('chunk "assets/index.js"');
    expect(lines[1]).toContain('Package "@connectrpc/connect"');
    expect(lines[2]).toContain('Package "three"');
    expect(lines[2]).toContain('chunk "assets/vendor.js"');
  });

  it('reports a package violation together with a size violation', () => {
    const run = createRunner(
      entryGzipKiloBytes / 2,
      {
        'assets/index.js': createChunk('assets/index.js', entryCode, {
          isEntry: true,
          moduleIds: ['/repo/node_modules/three/build/three.module.js'],
        }),
      },
      ['three'],
    );

    expect(run).toThrow('Package "three"');
    expect(run).toThrow('exceeds the budget');
  });

  it('behaves as before with an empty list', () => {
    const bundle = {
      'assets/index.js': createChunk('assets/index.js', entryCode, {
        isEntry: true,
        moduleIds: ['/repo/node_modules/three/build/three.module.js'],
      }),
    };

    expect(createRunner(100, bundle, [])).not.toThrow();
    expect(console.log).toHaveBeenCalledTimes(1);
  });
});
