import {
  describe,
  expect,
  it,
} from 'vitest';

import type { PreloadChunkValue } from './criticalPreloadTypes.ts';

import { collectImportClosure } from './collectImportClosure.ts';

const createChunk = (fileName: string, imports: readonly string[] = []): PreloadChunkValue => ({
  fileName,
  imports,
  isDynamicEntry: false,
  isEntry: false,
  moduleIds: [],
});

describe('collectImportClosure', () => {
  it('lists a root before its static imports and one root after another', () => {
    const chunks = [
      createChunk('a.js', ['a-dependency.js']),
      createChunk('a-dependency.js'),
      createChunk('b.js', ['b-dependency.js']),
      createChunk('b-dependency.js'),
    ];

    expect(collectImportClosure(['a.js', 'b.js'], chunks)).toEqual(['a.js', 'a-dependency.js', 'b.js', 'b-dependency.js']);
  });

  it('lists a chunk imported by several roots once', () => {
    const chunks = [
      createChunk('a.js', ['shared.js']),
      createChunk('b.js', ['shared.js']),
      createChunk('shared.js'),
    ];

    expect(collectImportClosure(['a.js', 'b.js'], chunks)).toEqual(['a.js', 'shared.js', 'b.js']);
  });

  it('follows imports of imports and survives an import cycle', () => {
    const chunks = [
      createChunk('a.js', ['b.js']),
      createChunk('b.js', ['c.js']),
      createChunk('c.js', ['a.js']),
    ];

    expect(collectImportClosure(['a.js'], chunks)).toEqual(['a.js', 'b.js', 'c.js']);
  });

  it('leaves out skipped chunks and what is reachable only through them', () => {
    const chunks = [
      createChunk('a.js', ['skipped.js', 'own.js']),
      createChunk('skipped.js', ['behind-skipped.js']),
      createChunk('behind-skipped.js'),
      createChunk('own.js'),
    ];

    expect(collectImportClosure(['a.js'], chunks, new Set(['skipped.js']))).toEqual(['a.js', 'own.js']);
  });

  it('ignores files that are not chunks of the bundle', () => {
    expect(collectImportClosure(['a.js'], [createChunk('a.js', ['asset.css'])])).toEqual(['a.js']);
  });
});
