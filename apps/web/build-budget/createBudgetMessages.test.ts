import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  InitialBundleValue,
  LazyBudgetMeasurementValue,
} from './bundleBudgetTypes.ts';

import {
  createAnyChunkForbiddenPackageMessage,
  createBudgetReport,
  createBudgetViolationMessage,
  createForbiddenPackageMessage,
  createLazyBudgetReport,
  createLazyBudgetViolationMessage,
  createMissingLazyEntryMessage,
} from './createBudgetMessages.ts';

const bundle: InitialBundleValue = {
  chunks: [
    { fileName: 'assets/index.js', gzipBytes: 127_260 },
    { fileName: 'assets/i18n.js', gzipBytes: 3_200 },
  ],
  entryFileName: 'assets/index.js',
  gzipBytes: 130_460,
};

describe('createBudgetReport', () => {
  it('reports size, limit and headroom in kilobytes', () => {
    expect(createBudgetReport(bundle, 140_000)).toEqual({
      chunks: ['assets/index.js 127.26 kB', 'assets/i18n.js 3.20 kB'],
      entry: 'assets/index.js',
      headroomKiloBytes: 9.54,
      initialGzipKiloBytes: 130.46,
      limitKiloBytes: 140,
    });
  });
});

describe('createBudgetViolationMessage', () => {
  it('names the entry, size, limit, overshoot and chunks', () => {
    const message = createBudgetViolationMessage(bundle, 120_000);

    expect(message).toContain('"assets/index.js"');
    expect(message).toContain('130.46 kB gzip');
    expect(message).toContain('120.00 kB');
    expect(message).toContain('10.46 kB');
    expect(message).toContain('assets/index.js 127.26 kB, assets/i18n.js 3.20 kB');
  });
});

describe('createForbiddenPackageMessage', () => {
  it('names the package, entry and chunk', () => {
    const message = createForbiddenPackageMessage({
      chunkFileName: 'assets/vendor.js',
      entryFileName: 'assets/index.js',
      packageName: '@tanstack/query-core',
    });

    expect(message).toContain('Package "@tanstack/query-core"');
    expect(message).toContain('entry "assets/index.js"');
    expect(message).toContain('chunk "assets/vendor.js"');
    expect(message).toContain('dynamic import()');
  });
});

const lazyMeasurement: LazyBudgetMeasurementValue = {
  budget: { entries: ['src/scene/Root.tsx', 'src/scene/Board.tsx'], maxGzipKiloBytes: 300, name: 'scene' },
  chunks: [
    { fileName: 'assets/Root.js', gzipBytes: 250_000 },
    { fileName: 'assets/three.js', gzipBytes: 62_500 },
  ],
  gzipBytes: 312_500,
  missingEntries: [],
};

describe('createLazyBudgetReport', () => {
  it('reports name, entries, size, limit and headroom in kilobytes', () => {
    expect(createLazyBudgetReport(lazyMeasurement, 320_000)).toEqual({
      chunks: ['assets/Root.js 250.00 kB', 'assets/three.js 62.50 kB'],
      entries: ['src/scene/Root.tsx', 'src/scene/Board.tsx'],
      gzipKiloBytes: 312.5,
      headroomKiloBytes: 7.5,
      limitKiloBytes: 320,
      name: 'scene',
    });
  });
});

describe('createLazyBudgetViolationMessage', () => {
  it('names the budget, size, limit, overshoot, entries and chunks', () => {
    const message = createLazyBudgetViolationMessage(lazyMeasurement, 300_000);

    expect(message).toContain('"scene"');
    expect(message).toContain('312.50 kB gzip');
    expect(message).toContain('300.00 kB');
    expect(message).toContain('12.50 kB');
    expect(message).toContain('src/scene/Root.tsx, src/scene/Board.tsx');
    expect(message).toContain('assets/Root.js 250.00 kB, assets/three.js 62.50 kB');
  });
});

describe('createMissingLazyEntryMessage', () => {
  it('names the budget and the entry', () => {
    const message = createMissingLazyEntryMessage('scene', 'src/scene/Root.tsx');

    expect(message).toContain('"scene"');
    expect(message).toContain('"src/scene/Root.tsx"');
  });
});

describe('createAnyChunkForbiddenPackageMessage', () => {
  it('names the package and the chunk', () => {
    const message = createAnyChunkForbiddenPackageMessage({ chunkFileName: 'assets/scene.js', packageName: 'stats-gl' });

    expect(message).toContain('Package "stats-gl"');
    expect(message).toContain('chunk "assets/scene.js"');
  });
});
