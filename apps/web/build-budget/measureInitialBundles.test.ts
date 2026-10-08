import {
  describe,
  expect,
  it,
} from 'vitest';

import type { BudgetChunkValue } from './bundleBudgetTypes.ts';

import { measureInitialBundles } from './measureInitialBundles.ts';

const createChunk = (overrides: Partial<BudgetChunkValue> & Pick<BudgetChunkValue, 'fileName'>): BudgetChunkValue => ({
  gzipBytes: 100,
  imports: [],
  isEntry: false,
  ...overrides,
});

describe('measureInitialBundles', () => {
  it('returns nothing when there are no entries', () => {
    expect(measureInitialBundles([createChunk({ fileName: 'lazy.js' })])).toEqual([]);
  });

  it('counts the entry chunk alone', () => {
    const bundles = measureInitialBundles([createChunk({ fileName: 'index.js', gzipBytes: 1_234, isEntry: true })]);

    expect(bundles).toEqual([
      {
        chunks: [{ fileName: 'index.js', gzipBytes: 1_234 }],
        entryFileName: 'index.js',
        gzipBytes: 1_234,
      },
    ]);
  });

  it('ignores chunks reachable only through dynamic imports', () => {
    const bundles = measureInitialBundles([
      createChunk({ fileName: 'index.js', gzipBytes: 1_000, isEntry: true }),
      createChunk({ fileName: 'deals.js', gzipBytes: 50_000 }),
    ]);

    expect(bundles[0]?.gzipBytes).toBe(1_000);
    expect(bundles[0]?.chunks.map(chunk => chunk.fileName)).toEqual(['index.js']);
  });

  it('counts a statically imported shared chunk', () => {
    const bundles = measureInitialBundles([
      createChunk({ fileName: 'index.js', gzipBytes: 1_000, imports: ['i18n.js'], isEntry: true }),
      createChunk({ fileName: 'i18n.js', gzipBytes: 3_200 }),
    ]);

    expect(bundles[0]?.gzipBytes).toBe(4_200);
    expect(bundles[0]?.chunks.map(chunk => chunk.fileName)).toEqual(['index.js', 'i18n.js']);
  });

  it('counts transitive static imports', () => {
    const bundles = measureInitialBundles([
      createChunk({ fileName: 'index.js', gzipBytes: 1, imports: ['a.js'], isEntry: true }),
      createChunk({ fileName: 'a.js', gzipBytes: 10, imports: ['b.js'] }),
      createChunk({ fileName: 'b.js', gzipBytes: 100 }),
    ]);

    expect(bundles[0]?.gzipBytes).toBe(111);
  });

  it('counts a shared chunk once in a diamond', () => {
    const bundles = measureInitialBundles([
      createChunk({ fileName: 'index.js', gzipBytes: 1, imports: ['a.js', 'b.js'], isEntry: true }),
      createChunk({ fileName: 'a.js', gzipBytes: 10, imports: ['shared.js'] }),
      createChunk({ fileName: 'b.js', gzipBytes: 100, imports: ['shared.js'] }),
      createChunk({ fileName: 'shared.js', gzipBytes: 1_000 }),
    ]);

    expect(bundles[0]?.gzipBytes).toBe(1_111);
    expect(bundles[0]?.chunks.map(chunk => chunk.fileName)).toEqual(['index.js', 'a.js', 'b.js', 'shared.js']);
  });

  it('survives import cycles', () => {
    const bundles = measureInitialBundles([
      createChunk({ fileName: 'index.js', gzipBytes: 1, imports: ['a.js'], isEntry: true }),
      createChunk({ fileName: 'a.js', gzipBytes: 10, imports: ['index.js'] }),
    ]);

    expect(bundles[0]?.gzipBytes).toBe(11);
  });

  it('skips imports that are not part of the bundle', () => {
    const bundles = measureInitialBundles([
      createChunk({ fileName: 'index.js', gzipBytes: 5, imports: ['https://cdn.example/lib.js'], isEntry: true }),
    ]);

    expect(bundles[0]?.gzipBytes).toBe(5);
  });

  it('measures every entry separately', () => {
    const bundles = measureInitialBundles([
      createChunk({ fileName: 'main.js', gzipBytes: 10, imports: ['shared.js'], isEntry: true }),
      createChunk({ fileName: 'admin.js', gzipBytes: 20, imports: ['shared.js'], isEntry: true }),
      createChunk({ fileName: 'shared.js', gzipBytes: 100 }),
    ]);

    expect(bundles.map(bundle => [bundle.entryFileName, bundle.gzipBytes])).toEqual([
      ['main.js', 110],
      ['admin.js', 120],
    ]);
  });
});
