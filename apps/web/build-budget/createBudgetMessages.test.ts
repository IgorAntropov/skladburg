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
  createIncompleteBaselineMessage,
  createLazyBudgetForbiddenPackageMessage,
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
  baselineMissingEntries: [],
  budget: { entries: ['src/scene/Root.tsx', 'src/scene/Board.tsx'], maxGzipKiloBytes: 300, name: 'scene' },
  chunks: [
    { fileName: 'assets/Root.js', gzipBytes: 250_000 },
    { fileName: 'assets/three.js', gzipBytes: 62_500 },
  ],
  gzipBytes: 312_500,
  missingEntries: [],
  totalGzipBytes: 312_500,
};

const baselineMeasurement: LazyBudgetMeasurementValue = {
  baselineMissingEntries: [],
  budget: { baseline: 'startup', entries: ['src/pages/network/ui/Panel.tsx'], maxGzipKiloBytes: 12, name: 'panel' },
  chunks: [{ fileName: 'assets/Panel.js', gzipBytes: 13_250 }],
  gzipBytes: 13_250,
  missingEntries: [],
  totalGzipBytes: 93_250,
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

describe('createLazyBudgetReport with a baseline', () => {
  it('reports the size over the baseline, the total with it and the baseline name', () => {
    expect(createLazyBudgetReport(baselineMeasurement, 12_000)).toEqual({
      baseline: 'startup',
      chunks: ['assets/Panel.js 13.25 kB'],
      entries: ['src/pages/network/ui/Panel.tsx'],
      gzipKiloBytes: 13.25,
      headroomKiloBytes: -1.25,
      limitKiloBytes: 12,
      name: 'panel',
      totalGzipKiloBytes: 93.25,
    });
  });

  it('leaves out the baseline fields without a baseline', () => {
    const report = createLazyBudgetReport(lazyMeasurement, 320_000);

    expect(report).not.toHaveProperty('baseline');
    expect(report).not.toHaveProperty('totalGzipKiloBytes');
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

describe('createLazyBudgetViolationMessage with a baseline', () => {
  it('names the baseline and shows both the size over it and the total', () => {
    const message = createLazyBudgetViolationMessage(baselineMeasurement, 12_000);

    expect(message).toContain('"panel"');
    expect(message).toContain('13.25 kB gzip on top of the baseline "startup"');
    expect(message).toContain('93.25 kB gzip together with it');
    expect(message).toContain('budget of 12.00 kB by 1.25 kB');
    expect(message).not.toContain('outside the initial JS');
  });
});

describe('createIncompleteBaselineMessage', () => {
  it('names the budget and the baseline', () => {
    const message = createIncompleteBaselineMessage('panel', 'startup');

    expect(message).toContain('Lazy bundle "panel"');
    expect(message).toContain('baseline "startup"');
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

describe('createLazyBudgetForbiddenPackageMessage', () => {
  it('names the budget, the package and the chunk', () => {
    const message = createLazyBudgetForbiddenPackageMessage('scene', {
      chunkFileName: 'assets/shared.js',
      packageName: '@radix-ui/react-dialog',
    });

    expect(message).toContain('Lazy bundle "scene"');
    expect(message).toContain('package "@radix-ui/react-dialog"');
    expect(message).toContain('chunk "assets/shared.js"');
  });
});
