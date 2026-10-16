import type {
  CriticalPreloadBundleValue,
  PreloadFileValue,
} from './criticalPreloadTypes.ts';

import { gzipSizeInBytes } from '../build-budget/gzipSizeInBytes.ts';
import { hasEntryModule } from './isEntryModule.ts';

export const collectEngineWorkerFiles = (
  bundle: CriticalPreloadBundleValue,
  workerEntries: readonly string[],
): PreloadFileValue[] => {
  const chunks = Object.values(bundle).flatMap(output => output.type === 'chunk' ? [output] : []);
  const entryChunk = chunks.find(chunk =>
    chunk.isEntry && workerEntries.some(workerEntry => hasEntryModule(chunk.moduleIds, workerEntry)),
  );

  if (entryChunk === undefined) {
    return [];
  }

  return [entryChunk, ...chunks.filter(chunk => chunk !== entryChunk)].map(chunk => ({
    fileName: chunk.fileName,
    gzipBytes: gzipSizeInBytes(chunk.code),
  }));
};
