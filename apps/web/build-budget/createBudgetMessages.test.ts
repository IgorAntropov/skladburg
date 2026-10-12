import {
  describe,
  expect,
  it,
} from 'vitest';

import type { InitialBundleValue } from './bundleBudgetTypes.ts';

import {
  createBudgetReport,
  createBudgetViolationMessage,
  createForbiddenPackageMessage,
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
