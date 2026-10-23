import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  dirname,
  join,
} from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { AssetBudgetValue } from './bundleBudgetTypes.ts';

import { BYTES_PER_KILOBYTE } from './bundleBudgetConstants.ts';
import {
  assertValidAssetBudgets,
  measureAssetBudget,
} from './measureAssetBudget.ts';

const createBudget = (overrides: Partial<AssetBudgetValue> = {}): AssetBudgetValue => ({
  directory: 'models',
  extensions: ['.bin'],
  isRequired: true,
  maxKiloBytes: 300,
  name: 'world-models',
  ...overrides,
});

describe('measureAssetBudget', () => {
  let outDir = '';

  const writeAsset = (relativePath: string, bytes: number): void => {
    const filePath = join(outDir, relativePath);

    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, Buffer.alloc(bytes));
  };

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'asset-budget-'));
  });

  afterEach(() => {
    rmSync(outDir, { force: true, recursive: true });
  });

  it('finds no files when the directory does not exist', () => {
    const measurement = measureAssetBudget(outDir, createBudget());

    expect(measurement.files).toEqual([]);
    expect(measurement.bytes).toBe(0);
  });

  it('finds no files when the directory has no file with the extension', () => {
    writeAsset('models/License.txt', 10);

    expect(measureAssetBudget(outDir, createBudget()).files).toEqual([]);
  });

  it('sums raw bytes of nested files with the listed extensions', () => {
    writeAsset('models/commercial/building-a.bin', 1200);
    writeAsset('models/industrial/building-k.bin', 800);
    writeAsset('models/top.bin', 100);

    const measurement = measureAssetBudget(outDir, createBudget());

    expect(measurement.bytes).toBe(2100);
    expect(measurement.files).toEqual([
      { bytes: 1200, fileName: 'models/commercial/building-a.bin' },
      { bytes: 800, fileName: 'models/industrial/building-k.bin' },
      { bytes: 100, fileName: 'models/top.bin' },
    ]);
  });

  it('ignores files with other extensions and files outside the directory', () => {
    writeAsset('models/a.bin', 500);
    writeAsset('models/License.txt', 4000);
    writeAsset('models/a.bin.map', 4000);
    writeAsset('other/b.bin', 4000);

    expect(measureAssetBudget(outDir, createBudget()).bytes).toBe(500);
  });

  it('matches extensions regardless of case and supports several extensions', () => {
    writeAsset('models/a.BIN', 100);
    writeAsset('models/b.gltf', 200);
    writeAsset('models/c.png', 400);

    expect(measureAssetBudget(outDir, createBudget({ extensions: ['.bin', '.gltf'] })).bytes).toBe(300);
  });

  it('keeps the budget in the measurement', () => {
    const budget = createBudget({ name: 'other' });

    expect(measureAssetBudget(outDir, budget).budget).toBe(budget);
  });

  it('reports exactly the limit as not exceeding it', () => {
    writeAsset('models/a.bin', 300 * BYTES_PER_KILOBYTE);

    const measurement = measureAssetBudget(outDir, createBudget());

    expect(measurement.bytes).toBe(measurement.budget.maxKiloBytes * BYTES_PER_KILOBYTE);
  });

  it('reports a single byte over the limit', () => {
    writeAsset('models/a.bin', 300 * BYTES_PER_KILOBYTE + 1);

    const measurement = measureAssetBudget(outDir, createBudget());

    expect(measurement.bytes).toBeGreaterThan(measurement.budget.maxKiloBytes * BYTES_PER_KILOBYTE);
  });
});

describe('assertValidAssetBudgets', () => {
  it('accepts a valid budget', () => {
    expect(() => {
      assertValidAssetBudgets([createBudget()]);
    }).not.toThrow();
  });

  it.each([
    ['blank name', { name: ' ' }],
    ['blank directory', { directory: '' }],
    ['no extensions', { extensions: [] }],
    ['extension without a dot', { extensions: ['bin'] }],
    ['only a dot', { extensions: ['.'] }],
    ['zero limit', { maxKiloBytes: 0 }],
    ['negative limit', { maxKiloBytes: -1 }],
    ['infinite limit', { maxKiloBytes: Number.POSITIVE_INFINITY }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => {
      assertValidAssetBudgets([createBudget(overrides)]);
    }).toThrow('Asset budget');
  });
});
