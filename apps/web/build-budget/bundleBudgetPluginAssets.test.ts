import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { BundleBudgetContextValue } from './bundleBudgetPlugin.ts';
import type { AssetBudgetValue } from './bundleBudgetTypes.ts';

import { bundleBudgetPlugin } from './bundleBudgetPlugin.ts';

const createContext = (): BundleBudgetContextValue => ({
  error: (message: string): never => {
    throw new Error(message);
  },
});

const createBudget = (overrides: Partial<AssetBudgetValue> = {}): AssetBudgetValue => ({
  directory: 'models',
  extensions: ['.bin'],
  isRequired: true,
  maxKiloBytes: 1,
  name: 'world-models',
  ...overrides,
});

describe('bundleBudgetPlugin asset budgets', () => {
  let root = '';

  const writeModel = (fileName: string, bytes: number): void => {
    mkdirSync(join(root, 'dist', 'models'), { recursive: true });
    writeFileSync(join(root, 'dist', 'models', fileName), Buffer.alloc(bytes));
  };

  const runWriteBundle = (assetBudgets: readonly AssetBudgetValue[]): void => {
    const plugin = bundleBudgetPlugin({ assetBudgets, forbiddenInitialPackages: [], maxInitialGzipKiloBytes: 90 });

    plugin.configResolved({ build: { outDir: 'dist' }, root });
    plugin.writeBundle.call(createContext());
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'asset-budget-plugin-'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
    vi.restoreAllMocks();
  });

  it('passes and logs a report when the files fit', () => {
    writeModel('a.bin', 600);
    writeModel('b.bin', 400);

    runWriteBundle([createBudget()]);

    expect(console.log).toHaveBeenCalledWith(
      '> bundleBudgetPlugin -> writeBundle:',
      expect.objectContaining({ kiloBytes: 1, maxKiloBytes: 1, name: 'world-models' }),
    );
  });

  it('fails with the overshoot and the file list when the files exceed the limit', () => {
    writeModel('a.bin', 1500);

    expect(() => {
      runWriteBundle([createBudget()]);
    }).toThrow('Asset bundle "world-models" weighs 1.50 kB raw');
  });

  it('fails when a required budget finds no files', () => {
    expect(() => {
      runWriteBundle([createBudget()]);
    }).toThrow('no file with extension .bin');
  });

  it('passes without files when the budget is not required and stays silent', () => {
    runWriteBundle([createBudget({ isRequired: false })]);

    expect(console.log).not.toHaveBeenCalled();
  });

  it('does nothing without asset budgets', () => {
    runWriteBundle([]);

    expect(console.log).not.toHaveBeenCalled();
  });

  it('rejects an invalid asset budget at creation', () => {
    expect(() =>
      bundleBudgetPlugin({
        assetBudgets: [createBudget({ maxKiloBytes: 0 })],
        forbiddenInitialPackages: [],
        maxInitialGzipKiloBytes: 90,
      }),
    ).toThrow('positive number of kilobytes');
  });
});
