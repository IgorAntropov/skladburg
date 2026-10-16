import type {
  CriticalPreloadEntryValue,
  PreloadChunkValue,
} from './criticalPreloadTypes.ts';

import { collectImportClosure } from './collectImportClosure.ts';
import { toWorkerWrapperKey } from './hintPointKeys.ts';
import { hasEntryModule } from './isEntryModule.ts';

export interface CriticalPreloadPlanInputValue {
  chunks: readonly PreloadChunkValue[];
  deferredEntries: readonly string[];
  entries: readonly CriticalPreloadEntryValue[];
  isDemoTransport: boolean;
  skippedFileNames: ReadonlySet<string>;
  unhintedEntries: readonly string[];
  workerChunks: readonly PreloadChunkValue[];
  workerDynamicEntries: readonly string[];
  workerEntries: readonly string[];
}

export interface CriticalPreloadPlanValue {
  deferredFileNames: string[];
  mainThreadFileNames: string[];
  rootFileNamesByKey: Record<string, string[]>;
  workerFileNames: string[];
}

interface HintPointValue {
  isWorker: boolean;
  key: string;
  rootFileNames: string[];
}

const findDynamicEntryFileNames = (chunks: readonly PreloadChunkValue[], entry: string): string[] =>
  chunks
    .filter(chunk => chunk.isDynamicEntry && hasEntryModule(chunk.moduleIds, entry))
    .map(chunk => chunk.fileName);

const findEntryFileNames = (chunks: readonly PreloadChunkValue[], entry: string): string[] =>
  chunks.filter(chunk => chunk.isEntry && hasEntryModule(chunk.moduleIds, entry)).map(chunk => chunk.fileName);

const isActiveEntry = (entry: CriticalPreloadEntryValue, isDemoTransport: boolean): boolean =>
  isDemoTransport || entry.isDemoOnly !== true;

export const planCriticalPreload = ({
  chunks,
  deferredEntries,
  entries,
  isDemoTransport,
  skippedFileNames,
  unhintedEntries,
  workerChunks,
  workerDynamicEntries,
  workerEntries,
}: CriticalPreloadPlanInputValue): CriticalPreloadPlanValue => {
  const points: HintPointValue[] = [];
  const missing: string[] = [];

  for (const { entry, isRequired } of entries.filter(candidate => isActiveEntry(candidate, isDemoTransport))) {
    const rootFileNames = findDynamicEntryFileNames(chunks, entry);

    if (rootFileNames.length === 0 && isRequired) {
      missing.push(entry);
    }

    points.push({ isWorker: false, key: entry, rootFileNames });
  }

  if (isDemoTransport) {
    for (const workerEntry of workerEntries) {
      const rootFileNames = findDynamicEntryFileNames(chunks, workerEntry);

      if (rootFileNames.length === 0) {
        missing.push(toWorkerWrapperKey(workerEntry));
      }

      points.push({ isWorker: false, key: toWorkerWrapperKey(workerEntry), rootFileNames });
    }

    if (workerChunks.length === 0) {
      missing.push(`the worker bundle of ${workerEntries.join(', ')}`);
    }
    else {
      for (const workerEntry of workerEntries) {
        const rootFileNames = findEntryFileNames(workerChunks, workerEntry);

        if (rootFileNames.length === 0) {
          missing.push(`${workerEntry} in the worker bundle`);
        }

        points.push({ isWorker: true, key: workerEntry, rootFileNames });
      }

      for (const entry of workerDynamicEntries) {
        const rootFileNames = findDynamicEntryFileNames(workerChunks, entry);

        if (rootFileNames.length === 0) {
          missing.push(`${entry} in the worker bundle`);
        }

        points.push({ isWorker: true, key: entry, rootFileNames });
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Critical preload: the bundle has no required entry: ${missing.join(', ')}`);
  }

  const unhintedKeys = new Set(unhintedEntries);
  const hintedPoints = points.filter(point => !unhintedKeys.has(point.key));
  const deferredKeys = isDemoTransport ? deferredEntries : [];
  const deferredKeySet = new Set(deferredKeys);
  const deferredPoints = deferredKeys.flatMap(key => hintedPoints.filter(point => point.key === key));
  const indexPoints = hintedPoints.filter(point => !deferredKeySet.has(point.key));
  const allChunks = [...chunks, ...workerChunks];
  const claimedFileNames = new Set(skippedFileNames);

  const claimClosure = (selected: readonly HintPointValue[]): string[] => {
    const fileNames = collectImportClosure(
      selected.flatMap(point => point.rootFileNames),
      allChunks,
      claimedFileNames,
    );

    for (const fileName of fileNames) {
      claimedFileNames.add(fileName);
    }

    return fileNames;
  };

  const mainThreadFileNames = claimClosure(indexPoints.filter(point => !point.isWorker));
  const workerFileNames = claimClosure(indexPoints.filter(point => point.isWorker));
  const deferredFileNames = claimClosure(deferredPoints);

  return {
    deferredFileNames,
    mainThreadFileNames,
    rootFileNamesByKey: Object.fromEntries(points.map(point => [point.key, point.rootFileNames])),
    workerFileNames,
  };
};
