import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  CriticalPreloadEntryValue,
  PreloadChunkValue,
} from './criticalPreloadTypes.ts';
import type { CriticalPreloadPlanInputValue } from './planCriticalPreload.ts';

import { planCriticalPreload } from './planCriticalPreload.ts';

const MOUNT_ENTRY: CriticalPreloadEntryValue = { entry: 'src/app/mountApp.tsx', isRequired: true };

const DEMO_ENTRY: CriticalPreloadEntryValue = { entry: 'src/api/demo/index.ts', isDemoOnly: true, isRequired: true };

const WORKER_ENTRY = 'packages/demo-engine/src/host/worker.ts';

const WRAPPER_KEY = `${WORKER_ENTRY}?worker`;

const ENGINE_ENTRY = 'packages/demo-engine/src/core/engine/index.ts';

const createChunk = (overrides: Partial<PreloadChunkValue> & Pick<PreloadChunkValue, 'fileName'>): PreloadChunkValue => ({
  imports: [],
  isDynamicEntry: false,
  isEntry: false,
  moduleIds: [],
  ...overrides,
});

const CHUNKS: readonly PreloadChunkValue[] = [
  createChunk({ fileName: 'index.js', isEntry: true }),
  createChunk({
    fileName: 'mount.js',
    imports: ['errors.js'],
    isDynamicEntry: true,
    moduleIds: ['/repo/apps/web/src/app/mountApp.tsx'],
  }),
  createChunk({ fileName: 'errors.js' }),
  createChunk({
    fileName: 'demo.js',
    imports: ['constants.js'],
    isDynamicEntry: true,
    moduleIds: ['/repo/apps/web/src/api/demo/index.ts'],
  }),
  createChunk({ fileName: 'constants.js' }),
  createChunk({
    fileName: 'wrapper.js',
    isDynamicEntry: true,
    moduleIds: ['/repo/packages/demo-engine/src/host/worker.ts?worker'],
  }),
];

const WORKER_CHUNKS: readonly PreloadChunkValue[] = [
  createChunk({
    fileName: 'worker.js',
    imports: ['worker-shared.js'],
    isEntry: true,
    moduleIds: ['/repo/packages/demo-engine/src/host/worker.ts?worker_file&type=module'],
  }),
  createChunk({ fileName: 'worker-shared.js' }),
  createChunk({
    fileName: 'engine.js',
    imports: ['engine-shared.js'],
    isDynamicEntry: true,
    moduleIds: ['/repo/packages/demo-engine/src/core/engine/index.ts'],
  }),
  createChunk({ fileName: 'engine-shared.js' }),
  createChunk({
    fileName: 'validator.js',
    isDynamicEntry: true,
    moduleIds: ['/repo/packages/demo-engine/src/core/validator/index.ts'],
  }),
];

const plan = (overrides: Partial<CriticalPreloadPlanInputValue> = {}): ReturnType<typeof planCriticalPreload> =>
  planCriticalPreload({
    chunks: CHUNKS,
    deferredEntries: [],
    entries: [MOUNT_ENTRY, DEMO_ENTRY],
    isDemoTransport: true,
    skippedFileNames: new Set(),
    workerChunks: WORKER_CHUNKS,
    workerDynamicEntries: [ENGINE_ENTRY],
    workerEntries: [WORKER_ENTRY],
    ...overrides,
  });

describe('planCriticalPreload', () => {
  it('lists the main thread chunks in the order of the entries and then the wrapper of the worker', () => {
    expect(plan().mainThreadFileNames).toEqual(['mount.js', 'errors.js', 'demo.js', 'constants.js', 'wrapper.js']);
  });

  it('lists the worker script with its static imports and then the listed dynamic points with theirs', () => {
    expect(plan().workerFileNames).toEqual(['worker.js', 'worker-shared.js', 'engine.js', 'engine-shared.js']);
  });

  it('does not hint a lazy chunk of the worker that is not in the list of dynamic points', () => {
    const result = plan({ deferredEntries: [WORKER_ENTRY, ENGINE_ENTRY] });

    expect([...result.workerFileNames, ...result.deferredFileNames]).not.toContain('validator.js');
    expect([...result.mainThreadFileNames, ...result.workerFileNames, ...result.deferredFileNames]).not.toContain('validator.js');
  });

  it('hints a lazy chunk of the worker once its entry joins the list of dynamic points', () => {
    const validatorEntry = 'packages/demo-engine/src/core/validator/index.ts';

    expect(plan({ workerDynamicEntries: [ENGINE_ENTRY, validatorEntry] }).workerFileNames).toContain('validator.js');
  });

  it('hints the static imports of the worker script and nothing the script does not import', () => {
    const chunks = WORKER_CHUNKS.map(chunk => chunk.fileName === 'worker.js' ? { ...chunk, imports: [] } : chunk);

    expect(plan({ workerChunks: chunks }).workerFileNames).toEqual(['worker.js', 'engine.js', 'engine-shared.js']);
  });

  it('moves the deferred entries from the page to the deferred list in the order of the option', () => {
    const result = plan({ deferredEntries: [WORKER_ENTRY, ENGINE_ENTRY] });

    expect(result.mainThreadFileNames).toEqual(['mount.js', 'errors.js', 'demo.js', 'constants.js', 'wrapper.js']);
    expect(result.workerFileNames).toEqual([]);
    expect(result.deferredFileNames).toEqual(['worker.js', 'worker-shared.js', 'engine.js', 'engine-shared.js']);
  });

  it('keeps the order of the option and not the order of the graph', () => {
    expect(plan({ deferredEntries: [ENGINE_ENTRY, WORKER_ENTRY] }).deferredFileNames).toEqual([
      'engine.js',
      'engine-shared.js',
      'worker.js',
      'worker-shared.js',
    ]);
  });

  it('keeps the dynamic point of the engine on the page when only the worker script is deferred', () => {
    const result = plan({ deferredEntries: [WORKER_ENTRY] });

    expect(result.workerFileNames).toEqual(['engine.js', 'engine-shared.js']);
    expect(result.deferredFileNames).toEqual(['worker.js', 'worker-shared.js']);
  });

  it('defers main thread entries and the wrapper of the worker with their imports', () => {
    const result = plan({ deferredEntries: [DEMO_ENTRY.entry, WRAPPER_KEY, WORKER_ENTRY, ENGINE_ENTRY] });

    expect(result.mainThreadFileNames).toEqual(['mount.js', 'errors.js']);
    expect(result.workerFileNames).toEqual([]);
    expect(result.deferredFileNames).toEqual([
      'demo.js',
      'constants.js',
      'wrapper.js',
      'worker.js',
      'worker-shared.js',
      'engine.js',
      'engine-shared.js',
    ]);
  });

  it('puts a file shared by the page and a deferred entry on the page only', () => {
    const chunks = CHUNKS.map(chunk => chunk.fileName === 'mount.js' ? { ...chunk, imports: ['errors.js', 'constants.js'] } : chunk);
    const result = plan({ chunks, deferredEntries: [DEMO_ENTRY.entry] });

    expect(result.mainThreadFileNames).toEqual(['mount.js', 'errors.js', 'constants.js', 'wrapper.js']);
    expect(result.deferredFileNames).toEqual(['demo.js']);
  });

  it('leaves out the files the page already loads', () => {
    const result = plan({ deferredEntries: [ENGINE_ENTRY], skippedFileNames: new Set(['engine-shared.js', 'errors.js']) });

    expect(result.mainThreadFileNames).toEqual(['mount.js', 'demo.js', 'constants.js', 'wrapper.js']);
    expect(result.workerFileNames).toEqual(['worker.js', 'worker-shared.js']);
    expect(result.deferredFileNames).toEqual(['engine.js']);
  });

  it('hints a file shared by the main thread and the worker only once', () => {
    const workerChunks = WORKER_CHUNKS.map(chunk => chunk.fileName === 'worker-shared.js' ? { ...chunk, fileName: 'constants.js' } : chunk)
      .map(chunk => chunk.fileName === 'worker.js' ? { ...chunk, imports: ['constants.js'] } : chunk);
    const result = plan({ workerChunks });

    expect(result.workerFileNames).toEqual(['worker.js', 'engine.js', 'engine-shared.js']);
  });

  it('hints only the main entry without the demo transport', () => {
    expect(plan({ deferredEntries: [WORKER_ENTRY, ENGINE_ENTRY], isDemoTransport: false })).toEqual({
      deferredFileNames: [],
      mainThreadFileNames: ['mount.js', 'errors.js'],
      workerFileNames: [],
    });
  });

  it('does not ask for the demo entry or the worker without the demo transport', () => {
    const chunks = CHUNKS.filter(chunk => !['constants.js', 'demo.js', 'wrapper.js'].includes(chunk.fileName));

    expect(plan({ chunks, isDemoTransport: false, workerChunks: [] }).mainThreadFileNames).toEqual(['mount.js', 'errors.js']);
  });

  it('fails when a required entry is missing from the bundle', () => {
    const chunks = CHUNKS.filter(chunk => chunk.fileName !== 'mount.js');

    expect(() => plan({ chunks })).toThrow('Critical preload: the bundle has no required entry: src/app/mountApp.tsx');
  });

  it('fails when the wrapper of the worker is missing from the bundle', () => {
    const chunks = CHUNKS.filter(chunk => chunk.fileName !== 'wrapper.js');

    expect(() => plan({ chunks })).toThrow(`Critical preload: the bundle has no required entry: ${WRAPPER_KEY}`);
  });

  it('fails when the worker bundle was not recorded', () => {
    expect(() => plan({ workerChunks: [] })).toThrow(
      `Critical preload: the bundle has no required entry: the worker bundle of ${WORKER_ENTRY}`,
    );
  });

  it('fails when a dynamic point of the worker is missing from the worker bundle', () => {
    const workerChunks = WORKER_CHUNKS.filter(chunk => chunk.fileName !== 'engine.js');

    expect(() => plan({ workerChunks })).toThrow(
      `Critical preload: the bundle has no required entry: ${ENGINE_ENTRY} in the worker bundle`,
    );
  });

  it('names every missing entry in one error', () => {
    expect(() => plan({ chunks: [], workerChunks: [] })).toThrow(
      `src/app/mountApp.tsx, src/api/demo/index.ts, ${WRAPPER_KEY}, the worker bundle of ${WORKER_ENTRY}`,
    );
  });

  it('ignores a missing entry that is not required', () => {
    const chunks = CHUNKS.filter(chunk => chunk.fileName !== 'mount.js');

    expect(plan({ chunks, entries: [{ ...MOUNT_ENTRY, isRequired: false }, DEMO_ENTRY] }).mainThreadFileNames).toEqual([
      'demo.js',
      'constants.js',
      'wrapper.js',
    ]);
  });

  it('does not take a chunk that is not a dynamic entry for the entry chunk', () => {
    const chunks = CHUNKS.map(chunk => chunk.fileName === 'mount.js' ? { ...chunk, isDynamicEntry: false } : chunk);

    expect(() => plan({ chunks })).toThrow('src/app/mountApp.tsx');
  });
});
