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
  BundleBudgetPluginOptionsValue,
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
  options: { imports?: string[]; isDynamicEntry?: boolean; isEntry?: boolean; moduleIds?: string[] } = {},
): BundleBudgetOutputValue => ({
  code,
  fileName,
  imports: options.imports ?? [],
  isDynamicEntry: options.isDynamicEntry ?? false,
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

const createOptionsRunner = (
  options: Partial<BundleBudgetPluginOptionsValue>,
  bundle: Record<string, BundleBudgetOutputValue>,
): (() => void) => {
  return () => {
    bundleBudgetPlugin({ forbiddenInitialPackages: [], maxInitialGzipKiloBytes: 100, ...options }).generateBundle.call(
      createContext(),
      {},
      bundle,
    );
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

describe('bundleBudgetPlugin forbidden packages in any chunk', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails when the package is in a lazy chunk and names the package and chunk', () => {
    const run = createOptionsRunner(
      { forbiddenPackages: ['stats-gl'] },
      {
        'assets/index.js': createChunk('assets/index.js', entryCode, { isEntry: true }),
        'assets/scene.js': createChunk('assets/scene.js', '', {
          isDynamicEntry: true,
          moduleIds: ['/repo/node_modules/stats-gl/dist/main.js'],
        }),
      },
    );

    expect(run).toThrow('Package "stats-gl"');
    expect(run).toThrow('chunk "assets/scene.js"');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('passes when the list is empty or the package is absent', () => {
    const bundle = {
      'assets/index.js': createChunk('assets/index.js', entryCode, { isEntry: true }),
      'assets/scene.js': createChunk('assets/scene.js', '', {
        isDynamicEntry: true,
        moduleIds: ['/repo/node_modules/stats-gl/dist/main.js'],
      }),
    };

    expect(createOptionsRunner({}, bundle)).not.toThrow();
    expect(createOptionsRunner({ forbiddenPackages: ['stats.js'] }, bundle)).not.toThrow();
  });

  it('rejects an invalid pattern', () => {
    expect(() => bundleBudgetPlugin({ forbiddenInitialPackages: [], forbiddenPackages: ['*'], maxInitialGzipKiloBytes: 90 })).toThrow(
      'exact package name',
    );
  });
});

describe('bundleBudgetPlugin lazy entry budgets', () => {
  const sceneEntry = 'src/scene/Root.tsx';
  const sceneCode = createNoise(20_000);
  const sceneKiloBytes = gzipSizeInBytes(sceneCode) / 1000;
  const sceneBundle = {
    'assets/index.js': createChunk('assets/index.js', entryCode, { isEntry: true }),
    'assets/Root.js': createChunk('assets/Root.js', sceneCode, {
      isDynamicEntry: true,
      moduleIds: ['/repo/apps/web/src/scene/Root.tsx'],
    }),
  };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the size of the lazy bundle when it fits', () => {
    createOptionsRunner(
      { lazyEntryBudgets: [{ entries: [sceneEntry], maxGzipKiloBytes: sceneKiloBytes + 1, name: 'scene' }] },
      sceneBundle,
    )();

    expect(console.log).toHaveBeenCalledWith(
      '> bundleBudgetPlugin -> generateBundle:',
      expect.objectContaining({ chunks: [expect.stringContaining('assets/Root.js')], name: 'scene' }),
    );
  });

  it('fails above the limit with name, size and limit', () => {
    const run = createOptionsRunner(
      { lazyEntryBudgets: [{ entries: [sceneEntry], maxGzipKiloBytes: sceneKiloBytes / 2, name: 'scene' }] },
      sceneBundle,
    );

    expect(run).toThrow('Lazy bundle "scene"');
    expect(run).toThrow(`${sceneKiloBytes.toFixed(2)} kB gzip`);
    expect(run).toThrow(`budget of ${(sceneKiloBytes / 2).toFixed(2)} kB`);
  });

  it('fails when a required entry is missing and only warns otherwise', () => {
    const missingBudget = { entries: ['src/scene/Gone.tsx'], maxGzipKiloBytes: 300, name: 'scene' };

    expect(createOptionsRunner({ lazyEntryBudgets: [{ ...missingBudget, isRequired: true }] }, sceneBundle)).toThrow(
      'module "src/scene/Gone.tsx"',
    );

    createOptionsRunner({ lazyEntryBudgets: [missingBudget] }, sceneBundle)();

    expect(console.warn).toHaveBeenCalledWith(
      '> bundleBudgetPlugin -> generateBundle:',
      expect.stringContaining('src/scene/Gone.tsx'),
    );
  });

  it('rejects an invalid budget', () => {
    expect(() =>
      bundleBudgetPlugin({
        forbiddenInitialPackages: [],
        lazyEntryBudgets: [{ entries: [], maxGzipKiloBytes: 300, name: 'scene' }],
        maxInitialGzipKiloBytes: 90,
      }),
    ).toThrow('at least one entry');
  });
});
