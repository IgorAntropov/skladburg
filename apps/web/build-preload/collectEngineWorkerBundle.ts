import type { CriticalPreloadBundleValue } from './criticalPreloadTypes.ts';
import type { BundleChunksValue } from './readBundleChunks.ts';

import { hasEntryChunk } from '../build-budget/isEntryModule.ts';
import { readBundleChunks } from './readBundleChunks.ts';

export const collectEngineWorkerBundle = (
  bundle: CriticalPreloadBundleValue,
  workerEntries: readonly string[],
): BundleChunksValue | undefined => {
  const workerBundle = readBundleChunks(bundle);

  return hasEntryChunk(workerBundle.chunks, workerEntries) ? workerBundle : undefined;
};
