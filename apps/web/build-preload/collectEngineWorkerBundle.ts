import type { CriticalPreloadBundleValue } from './criticalPreloadTypes.ts';
import type { BundleChunksValue } from './readBundleChunks.ts';

import { hasEntryModule } from './isEntryModule.ts';
import { readBundleChunks } from './readBundleChunks.ts';

export const collectEngineWorkerBundle = (
  bundle: CriticalPreloadBundleValue,
  workerEntries: readonly string[],
): BundleChunksValue | undefined => {
  const workerBundle = readBundleChunks(bundle);
  const hasEngineWorkerEntry = workerBundle.chunks.some(chunk =>
    chunk.isEntry && workerEntries.some(workerEntry => hasEntryModule(chunk.moduleIds, workerEntry)),
  );

  return hasEngineWorkerEntry ? workerBundle : undefined;
};
