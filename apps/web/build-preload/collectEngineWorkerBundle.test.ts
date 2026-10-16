import {
  describe,
  expect,
  it,
} from 'vitest';

import type { CriticalPreloadBundleValue } from './criticalPreloadTypes.ts';

import { collectEngineWorkerBundle } from './collectEngineWorkerBundle.ts';

const WORKER_ENTRY = 'packages/demo-engine/src/host/worker.ts';

const createWorkerBundle = (entryModuleId: string): CriticalPreloadBundleValue => ({
  'assets/engine-b.js': {
    code: 'export const engine = 1;',
    fileName: 'assets/engine-b.js',
    imports: [],
    isDynamicEntry: true,
    isEntry: false,
    moduleIds: ['/repo/packages/demo-engine/src/core/engine/index.ts'],
    type: 'chunk',
  },
  'assets/worker-a.js': {
    code: 'import("./engine-b.js");',
    fileName: 'assets/worker-a.js',
    imports: [],
    isDynamicEntry: false,
    isEntry: true,
    moduleIds: [entryModuleId],
    type: 'chunk',
  },
});

describe('collectEngineWorkerBundle', () => {
  it('reads every chunk of the bundle of the engine worker with its size', () => {
    const workerBundle = collectEngineWorkerBundle(
      createWorkerBundle('/repo/packages/demo-engine/src/host/worker.ts?worker_file&type=module'),
      [WORKER_ENTRY],
    );

    expect(workerBundle?.chunks.map(chunk => chunk.fileName).toSorted()).toEqual(['assets/engine-b.js', 'assets/worker-a.js']);
    expect([...workerBundle?.gzipBytesByFileName.values() ?? []].every(bytes => bytes > 0)).toBe(true);
  });

  it('finds nothing in the bundle of another worker', () => {
    expect(collectEngineWorkerBundle(createWorkerBundle('/repo/apps/web/src/terrain.worker.ts'), [WORKER_ENTRY])).toBeUndefined();
  });

  it('skips assets of the bundle', () => {
    const bundle: CriticalPreloadBundleValue = {
      ...createWorkerBundle('/repo/packages/demo-engine/src/host/worker.ts'),
      'assets/font.woff2': { type: 'asset' },
    };

    expect(collectEngineWorkerBundle(bundle, [WORKER_ENTRY])?.chunks).toHaveLength(2);
  });
});
