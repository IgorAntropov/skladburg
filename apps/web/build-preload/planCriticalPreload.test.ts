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

const plan = (overrides: Partial<CriticalPreloadPlanInputValue> = {}): ReturnType<typeof planCriticalPreload> =>
  planCriticalPreload({
    chunks: CHUNKS,
    entries: [MOUNT_ENTRY, DEMO_ENTRY],
    isDemoTransport: true,
    skippedFileNames: new Set(),
    workerEntries: [WORKER_ENTRY],
    workerFileNames: ['worker.js', 'engine.js'],
    ...overrides,
  });

describe('planCriticalPreload', () => {
  it('lists the main thread chunks in the order of the entries and then the wrapper of the worker', () => {
    expect(plan().mainThreadFileNames).toEqual(['mount.js', 'errors.js', 'demo.js', 'constants.js', 'wrapper.js']);
  });

  it('lists the worker files in the order the worker plugin recorded them', () => {
    expect(plan().workerFileNames).toEqual(['worker.js', 'engine.js']);
  });

  it('leaves out the files the page already loads', () => {
    const result = plan({ skippedFileNames: new Set(['engine.js', 'errors.js']) });

    expect(result.mainThreadFileNames).toEqual(['mount.js', 'demo.js', 'constants.js', 'wrapper.js']);
    expect(result.workerFileNames).toEqual(['worker.js']);
  });

  it('hints a file shared by the main thread and the worker only once', () => {
    const result = plan({ workerFileNames: ['constants.js', 'worker.js'] });

    expect(result.workerFileNames).toEqual(['worker.js']);
  });

  it('hints only the main entry without the demo transport', () => {
    expect(plan({ isDemoTransport: false })).toEqual({
      mainThreadFileNames: ['mount.js', 'errors.js'],
      workerFileNames: [],
    });
  });

  it('does not ask for the demo entry or the worker without the demo transport', () => {
    const chunks = CHUNKS.filter(chunk => !['constants.js', 'demo.js', 'wrapper.js'].includes(chunk.fileName));

    expect(plan({ chunks, isDemoTransport: false, workerFileNames: [] }).mainThreadFileNames).toEqual(['mount.js', 'errors.js']);
  });

  it('fails when a required entry is missing from the bundle', () => {
    const chunks = CHUNKS.filter(chunk => chunk.fileName !== 'mount.js');

    expect(() => plan({ chunks })).toThrow('Critical preload: the bundle has no required entry: src/app/mountApp.tsx');
  });

  it('fails when the wrapper of the worker is missing from the bundle', () => {
    const chunks = CHUNKS.filter(chunk => chunk.fileName !== 'wrapper.js');

    expect(() => plan({ chunks })).toThrow(`Critical preload: the bundle has no required entry: ${WORKER_ENTRY}?worker`);
  });

  it('fails when the worker bundle was not recorded', () => {
    expect(() => plan({ workerFileNames: [] })).toThrow(
      `Critical preload: the bundle has no required entry: the worker bundle of ${WORKER_ENTRY}`,
    );
  });

  it('names every missing entry in one error', () => {
    expect(() => plan({ chunks: [], workerFileNames: [] })).toThrow(
      `src/app/mountApp.tsx, src/api/demo/index.ts, ${WORKER_ENTRY}?worker, the worker bundle of ${WORKER_ENTRY}`,
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
