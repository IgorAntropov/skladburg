import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  BudgetChunkValue,
  LazyBudgetMeasurementValue,
  LazyEntryBudgetValue,
} from './bundleBudgetTypes.ts';

import { measureInitialBundles } from './measureInitialBundles.ts';
import {
  assertValidLazyEntryBudgets,
  measureLazyBudget,
} from './measureLazyBudget.ts';

const createChunk = (overrides: Partial<BudgetChunkValue> & Pick<BudgetChunkValue, 'fileName'>): BudgetChunkValue => ({
  gzipBytes: 100,
  imports: [],
  isDynamicEntry: false,
  isEntry: false,
  moduleIds: [],
  ...overrides,
});

const createBudget = (overrides: Partial<LazyEntryBudgetValue> = {}): LazyEntryBudgetValue => ({
  entries: ['src/scene/Root.tsx'],
  maxGzipKiloBytes: 300,
  name: 'scene',
  ...overrides,
});

const measure = (
  chunks: readonly BudgetChunkValue[],
  budget: LazyEntryBudgetValue = createBudget(),
): LazyBudgetMeasurementValue =>
  measureLazyBudget(chunks, measureInitialBundles(chunks), budget);

describe('measureLazyBudget', () => {
  it('counts the lazy entry chunk with its static imports', () => {
    const measurement = measure([
      createChunk({ fileName: 'index.js', gzipBytes: 1, isEntry: true }),
      createChunk({
        fileName: 'Root.js',
        gzipBytes: 10,
        imports: ['three.js'],
        isDynamicEntry: true,
        moduleIds: ['/repo/apps/web/src/scene/Root.tsx'],
      }),
      createChunk({ fileName: 'three.js', gzipBytes: 1_000 }),
    ]);

    expect(measurement.gzipBytes).toBe(1_010);
    expect(measurement.chunks.map(chunk => chunk.fileName)).toEqual(['Root.js', 'three.js']);
    expect(measurement.missingEntries).toEqual([]);
  });

  it('does not count chunks of the initial graph', () => {
    const measurement = measure([
      createChunk({ fileName: 'index.js', gzipBytes: 1, imports: ['react.js'], isEntry: true }),
      createChunk({ fileName: 'react.js', gzipBytes: 5_000 }),
      createChunk({
        fileName: 'Root.js',
        gzipBytes: 10,
        imports: ['react.js', 'three.js'],
        isDynamicEntry: true,
        moduleIds: ['/repo/apps/web/src/scene/Root.tsx'],
      }),
      createChunk({ fileName: 'three.js', gzipBytes: 1_000 }),
    ]);

    expect(measurement.gzipBytes).toBe(1_010);
    expect(measurement.chunks.map(chunk => chunk.fileName)).toEqual(['Root.js', 'three.js']);
  });

  it('counts a subgraph shared by two entries once', () => {
    const measurement = measure(
      [
        createChunk({ fileName: 'index.js', gzipBytes: 1, isEntry: true }),
        createChunk({
          fileName: 'Root.js',
          gzipBytes: 10,
          imports: ['three.js'],
          isDynamicEntry: true,
          moduleIds: ['/repo/apps/web/src/scene/Root.tsx'],
        }),
        createChunk({
          fileName: 'Board.js',
          gzipBytes: 20,
          imports: ['three.js'],
          isDynamicEntry: true,
          moduleIds: ['/repo/apps/web/src/pages/scene/Board.tsx'],
        }),
        createChunk({ fileName: 'three.js', gzipBytes: 1_000 }),
      ],
      createBudget({ entries: ['src/scene/Root.tsx', 'src/pages/scene/Board.tsx'] }),
    );

    expect(measurement.gzipBytes).toBe(1_030);
    expect(measurement.chunks.map(chunk => chunk.fileName)).toEqual(['Root.js', 'Board.js', 'three.js']);
  });

  it('does not follow dynamic imports of the lazy chunk', () => {
    const measurement = measure([
      createChunk({ fileName: 'index.js', gzipBytes: 1, isEntry: true }),
      createChunk({
        fileName: 'Root.js',
        gzipBytes: 10,
        isDynamicEntry: true,
        moduleIds: ['/repo/apps/web/src/scene/Root.tsx'],
      }),
      createChunk({ fileName: 'later.js', gzipBytes: 9_000, isDynamicEntry: true }),
    ]);

    expect(measurement.gzipBytes).toBe(10);
  });

  it('survives import cycles in the lazy graph', () => {
    const measurement = measure([
      createChunk({ fileName: 'index.js', gzipBytes: 1, isEntry: true }),
      createChunk({
        fileName: 'Root.js',
        gzipBytes: 10,
        imports: ['a.js'],
        isDynamicEntry: true,
        moduleIds: ['/repo/apps/web/src/scene/Root.tsx'],
      }),
      createChunk({ fileName: 'a.js', gzipBytes: 100, imports: ['Root.js'] }),
    ]);

    expect(measurement.gzipBytes).toBe(110);
  });

  it('reports an entry that is no dynamic entry of any chunk as missing', () => {
    const measurement = measure(
      [
        createChunk({ fileName: 'index.js', gzipBytes: 1, isEntry: true, moduleIds: ['/repo/apps/web/src/scene/Root.tsx'] }),
        createChunk({ fileName: 'other.js', gzipBytes: 50, moduleIds: ['/repo/apps/web/src/scene/Root.tsx'] }),
      ],
      createBudget({ entries: ['src/scene/Root.tsx', 'src/scene/Gone.tsx'] }),
    );

    expect(measurement.missingEntries).toEqual(['src/scene/Root.tsx', 'src/scene/Gone.tsx']);
    expect(measurement.gzipBytes).toBe(0);
  });

  it('keeps measuring found entries when another one is missing', () => {
    const measurement = measure(
      [
        createChunk({ fileName: 'index.js', gzipBytes: 1, isEntry: true }),
        createChunk({
          fileName: 'Root.js',
          gzipBytes: 10,
          isDynamicEntry: true,
          moduleIds: ['/repo/apps/web/src/scene/Root.tsx'],
        }),
      ],
      createBudget({ entries: ['src/scene/Root.tsx', 'src/scene/Gone.tsx'] }),
    );

    expect(measurement.gzipBytes).toBe(10);
    expect(measurement.missingEntries).toEqual(['src/scene/Gone.tsx']);
  });

  it('matches the entry by whole path segments and ignores query and separators', () => {
    const measurement = measure(
      [
        createChunk({ fileName: 'index.js', gzipBytes: 1, isEntry: true }),
        createChunk({
          fileName: 'Other.js',
          gzipBytes: 10,
          isDynamicEntry: true,
          moduleIds: ['/repo/apps/web/src/scene/OtherRoot.tsx'],
        }),
        createChunk({
          fileName: 'Root.js',
          gzipBytes: 20,
          isDynamicEntry: true,
          moduleIds: [String.raw`C:\repo\apps\web\src\scene\Root.tsx?used`],
        }),
      ],
      createBudget({ entries: ['src/scene/Root.tsx'] }),
    );

    expect(measurement.chunks.map(chunk => chunk.fileName)).toEqual(['Root.js']);
  });
});

describe('assertValidLazyEntryBudgets', () => {
  it('accepts valid budgets and an empty list', () => {
    expect(() => {
      assertValidLazyEntryBudgets([]);
    }).not.toThrow();
    expect(() => {
      assertValidLazyEntryBudgets([createBudget()]);
    }).not.toThrow();
  });

  it('rejects a blank name, no entries, a blank entry and a bad limit', () => {
    expect(() => {
      assertValidLazyEntryBudgets([createBudget({ name: ' ' })]);
    }).toThrow('non-empty name');
    expect(() => {
      assertValidLazyEntryBudgets([createBudget({ entries: [] })]);
    }).toThrow('at least one entry');
    expect(() => {
      assertValidLazyEntryBudgets([createBudget({ entries: [''] })]);
    }).toThrow('no blank entry');
    expect(() => {
      assertValidLazyEntryBudgets([createBudget({ maxGzipKiloBytes: 0 })]);
    }).toThrow('positive number');
    expect(() => {
      assertValidLazyEntryBudgets([createBudget({ maxGzipKiloBytes: Number.NaN })]);
    }).toThrow('positive number');
  });
});
