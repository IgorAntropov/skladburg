import {
  describe,
  expect,
  it,
} from 'vitest';

import type { CriticalPreloadBundleValue } from './criticalPreloadTypes.ts';

import { collectEngineWorkerFiles } from './collectEngineWorkerFiles.ts';

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

describe('collectEngineWorkerFiles', () => {
  it('lists the entry of the engine worker first and then its other chunks', () => {
    const files = collectEngineWorkerFiles(
      createWorkerBundle('/repo/packages/demo-engine/src/host/worker.ts?worker_file&type=module'),
      [WORKER_ENTRY],
    );

    expect(files.map(file => file.fileName)).toEqual(['assets/worker-a.js', 'assets/engine-b.js']);
    expect(files.every(file => file.gzipBytes > 0)).toBe(true);
  });

  it('finds nothing in the bundle of another worker', () => {
    expect(collectEngineWorkerFiles(createWorkerBundle('/repo/apps/web/src/terrain.worker.ts'), [WORKER_ENTRY])).toEqual([]);
  });

  it('skips assets of the bundle', () => {
    const bundle: CriticalPreloadBundleValue = {
      ...createWorkerBundle('/repo/packages/demo-engine/src/host/worker.ts'),
      'assets/font.woff2': { type: 'asset' },
    };

    expect(collectEngineWorkerFiles(bundle, [WORKER_ENTRY]).map(file => file.fileName)).toEqual([
      'assets/worker-a.js',
      'assets/engine-b.js',
    ]);
  });
});
