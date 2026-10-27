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
  findBaselineBudget,
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
  baseline?: LazyEntryBudgetValue,
): LazyBudgetMeasurementValue =>
  measureLazyBudget(chunks, measureInitialBundles(chunks), budget, baseline);

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

describe('measureLazyBudget with a baseline', () => {
  const startupBudget = createBudget({ entries: ['src/app/mountApp.tsx'], name: 'startup' });
  const panelBudget = createBudget({
    baseline: 'startup',
    entries: ['src/pages/network/ui/Panel.tsx'],
    name: 'panel',
  });
  const createChunks = (): BudgetChunkValue[] => [
    createChunk({ fileName: 'index.js', gzipBytes: 1, isEntry: true }),
    createChunk({
      fileName: 'mountApp.js',
      gzipBytes: 500,
      imports: ['shared.js'],
      isDynamicEntry: true,
      moduleIds: ['/repo/apps/web/src/app/mountApp.tsx'],
    }),
    createChunk({
      fileName: 'Panel.js',
      gzipBytes: 20,
      imports: ['shared.js', 'panelOnly.js'],
      isDynamicEntry: true,
      moduleIds: ['/repo/apps/web/src/pages/network/ui/Panel.tsx'],
    }),
    createChunk({ fileName: 'shared.js', gzipBytes: 7_000, imports: ['deep.js'] }),
    createChunk({ fileName: 'deep.js', gzipBytes: 300 }),
    createChunk({ fileName: 'panelOnly.js', gzipBytes: 40 }),
  ];

  it('leaves out the chunks of the baseline and keeps the total with them', () => {
    const measurement = measure(createChunks(), panelBudget, startupBudget);

    expect(measurement.chunks.map(chunk => chunk.fileName)).toEqual(['Panel.js', 'panelOnly.js']);
    expect(measurement.gzipBytes).toBe(60);
    expect(measurement.totalGzipBytes).toBe(7_360);
  });

  it('does not count the chunks of the initial graph in the total either', () => {
    const chunks = [
      createChunk({ fileName: 'index.js', gzipBytes: 1, imports: ['shared.js'], isEntry: true }),
      ...createChunks().slice(1),
    ];
    const measurement = measure(chunks, panelBudget, startupBudget);

    expect(measurement.totalGzipBytes).toBe(60);
    expect(measurement.gzipBytes).toBe(60);
  });

  it('measures the full graph when there is no baseline', () => {
    const measurement = measure(createChunks(), panelBudget);

    expect(measurement.gzipBytes).toBe(7_360);
    expect(measurement.totalGzipBytes).toBe(7_360);
    expect(measurement.baselineMissingEntries).toEqual([]);
  });

  it('reports the baseline entries missing from the build and counts the whole graph of the panel', () => {
    const missingBaseline = createBudget({ entries: ['src/app/Gone.tsx'], name: 'startup' });
    const measurement = measure(createChunks(), panelBudget, missingBaseline);

    expect(measurement.baselineMissingEntries).toEqual(['src/app/Gone.tsx']);
    expect(measurement.gzipBytes).toBe(7_360);
  });

  it('keeps the missing entries of the panel itself apart from those of the baseline', () => {
    const measurement = measure(
      createChunks(),
      createBudget({ baseline: 'startup', entries: ['src/pages/Gone.tsx'], name: 'panel' }),
      startupBudget,
    );

    expect(measurement.missingEntries).toEqual(['src/pages/Gone.tsx']);
    expect(measurement.baselineMissingEntries).toEqual([]);
    expect(measurement.gzipBytes).toBe(0);
  });
});

describe('findBaselineBudget', () => {
  it('finds the budget by the name of the baseline', () => {
    const startup = createBudget({ name: 'startup' });
    const panel = createBudget({ baseline: 'startup', name: 'panel' });

    expect(findBaselineBudget([startup, panel], panel)).toBe(startup);
    expect(findBaselineBudget([startup, panel], startup)).toBeUndefined();
  });
});

describe('assertValidLazyEntryBudgets', () => {
  it('accepts a baseline that is another budget without a baseline of its own', () => {
    expect(() => {
      assertValidLazyEntryBudgets([
        createBudget({ name: 'startup' }),
        createBudget({ baseline: 'startup', name: 'panel' }),
        createBudget({ baseline: 'startup', name: 'form' }),
      ]);
    }).not.toThrow();
  });

  it('rejects a baseline that does not exist', () => {
    expect(() => {
      assertValidLazyEntryBudgets([createBudget({ baseline: 'startup', name: 'panel' })]);
    }).toThrow('baseline "startup" that is not a lazy entry budget');
    expect(() => {
      assertValidLazyEntryBudgets([createBudget({ name: 'startup' }), createBudget({ baseline: '', name: 'panel' })]);
    }).toThrow('not a lazy entry budget');
  });

  it('rejects a budget that is its own baseline', () => {
    expect(() => {
      assertValidLazyEntryBudgets([createBudget({ baseline: 'panel', name: 'panel' })]);
    }).toThrow('cannot be its own baseline');
  });

  it('rejects a baseline that has a baseline of its own', () => {
    expect(() => {
      assertValidLazyEntryBudgets([
        createBudget({ name: 'startup' }),
        createBudget({ baseline: 'startup', name: 'mid' }),
        createBudget({ baseline: 'mid', name: 'panel' }),
      ]);
    }).toThrow('only one level is allowed');
  });

  it('rejects two budgets with one name', () => {
    expect(() => {
      assertValidLazyEntryBudgets([createBudget({ name: 'panel' }), createBudget({ name: 'panel' })]);
    }).toThrow('unique names');
  });

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
