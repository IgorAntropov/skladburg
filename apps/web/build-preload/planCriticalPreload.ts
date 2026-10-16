import type {
  CriticalPreloadEntryValue,
  PreloadChunkValue,
} from './criticalPreloadTypes.ts';

import { collectImportClosure } from './collectImportClosure.ts';
import { hasEntryModule } from './isEntryModule.ts';

export interface CriticalPreloadPlanInputValue {
  chunks: readonly PreloadChunkValue[];
  entries: readonly CriticalPreloadEntryValue[];
  isDemoTransport: boolean;
  skippedFileNames: ReadonlySet<string>;
  workerEntries: readonly string[];
  workerFileNames: readonly string[];
}

export interface CriticalPreloadPlanValue {
  mainThreadFileNames: string[];
  workerFileNames: string[];
}

const findDynamicEntryFileNames = (chunks: readonly PreloadChunkValue[], entry: string): string[] =>
  chunks
    .filter(chunk => chunk.isDynamicEntry && hasEntryModule(chunk.moduleIds, entry))
    .map(chunk => chunk.fileName);

const isActiveEntry = (entry: CriticalPreloadEntryValue, isDemoTransport: boolean): boolean =>
  isDemoTransport || entry.isDemoOnly !== true;

export const planCriticalPreload = ({
  chunks,
  entries,
  isDemoTransport,
  skippedFileNames,
  workerEntries,
  workerFileNames,
}: CriticalPreloadPlanInputValue): CriticalPreloadPlanValue => {
  const rootFileNames: string[] = [];
  const missing: string[] = [];

  for (const { entry, isRequired } of entries.filter(candidate => isActiveEntry(candidate, isDemoTransport))) {
    const entryFileNames = findDynamicEntryFileNames(chunks, entry);

    if (entryFileNames.length === 0 && isRequired) {
      missing.push(entry);
    }

    rootFileNames.push(...entryFileNames);
  }

  if (isDemoTransport) {
    for (const workerEntry of workerEntries) {
      const wrapperFileNames = findDynamicEntryFileNames(chunks, workerEntry);

      if (wrapperFileNames.length === 0) {
        missing.push(`${workerEntry}?worker`);
      }

      rootFileNames.push(...wrapperFileNames);
    }

    if (workerFileNames.length === 0) {
      missing.push(`the worker bundle of ${workerEntries.join(', ')}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Critical preload: the bundle has no required entry: ${missing.join(', ')}`);
  }

  const mainThreadFileNames = collectImportClosure(rootFileNames, chunks, skippedFileNames);
  const mainThreadSet = new Set(mainThreadFileNames);

  return {
    mainThreadFileNames,
    workerFileNames: isDemoTransport
      ? workerFileNames.filter(fileName => !skippedFileNames.has(fileName) && !mainThreadSet.has(fileName))
      : [],
  };
};
