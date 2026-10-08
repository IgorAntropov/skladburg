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
  options: { imports?: string[]; isEntry?: boolean } = {},
): BundleBudgetOutputValue => ({
  code,
  fileName,
  imports: options.imports ?? [],
  isEntry: options.isEntry ?? false,
  type: 'chunk',
});

const createContext = (): BundleBudgetContextValue => ({
  error: (message: string): never => {
    throw new Error(message);
  },
});

const runBudget = (maxInitialGzipKiloBytes: number, bundle: Record<string, BundleBudgetOutputValue>): void => {
  bundleBudgetPlugin({ maxInitialGzipKiloBytes }).generateBundle.call(createContext(), {}, bundle);
};

const createRunner = (maxInitialGzipKiloBytes: number, bundle: Record<string, BundleBudgetOutputValue>): (() => void) => {
  return () => {
    runBudget(maxInitialGzipKiloBytes, bundle);
  };
};

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
    expect(bundleBudgetPlugin({ maxInitialGzipKiloBytes: 140 }).apply).toBe('build');
  });

  it('rejects a non-positive or non-finite limit', () => {
    expect(() => bundleBudgetPlugin({ maxInitialGzipKiloBytes: 0 })).toThrow('positive number');
    expect(() => bundleBudgetPlugin({ maxInitialGzipKiloBytes: Number.NaN })).toThrow('positive number');
    expect(() => bundleBudgetPlugin({ maxInitialGzipKiloBytes: -1 })).toThrow('positive number');
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
});
