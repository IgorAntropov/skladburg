import type {
  CriticalPreloadBundleValue,
  CriticalPreloadHtmlContextValue,
  CriticalPreloadOptionsValue,
  CriticalPreloadValue,
  PreloadChunkValue,
  PreloadFileValue,
} from './criticalPreloadTypes.ts';

import { gzipSizeInBytes } from '../build-budget/gzipSizeInBytes.ts';
import { collectEngineWorkerFiles } from './collectEngineWorkerFiles.ts';
import { collectImportClosure } from './collectImportClosure.ts';
import { createPreloadReport } from './createPreloadReport.ts';
import {
  createPreloadTags,
  toPreloadHref,
} from './createPreloadTags.ts';
import { planCriticalPreload } from './planCriticalPreload.ts';
import { readLinkedHrefs } from './readLinkedHrefs.ts';

interface BundleChunksValue {
  chunks: PreloadChunkValue[];
  gzipBytesByFileName: Map<string, number>;
}

const readBundleChunks = (bundle: CriticalPreloadBundleValue): BundleChunksValue => {
  const chunks: PreloadChunkValue[] = [];
  const gzipBytesByFileName = new Map<string, number>();

  for (const output of Object.values(bundle)) {
    if (output.type === 'chunk') {
      chunks.push(output);
      gzipBytesByFileName.set(output.fileName, gzipSizeInBytes(output.code));
    }
  }

  return { chunks, gzipBytesByFileName };
};

const findInitialRootFileNames = (
  chunks: readonly PreloadChunkValue[],
  htmlChunk: CriticalPreloadHtmlContextValue['chunk'],
): string[] =>
  htmlChunk === undefined ? chunks.filter(chunk => chunk.isEntry).map(chunk => chunk.fileName) : [htmlChunk.fileName];

export const createCriticalPreload = ({
  entries,
  isDemoTransport,
  workerEntries,
}: CriticalPreloadOptionsValue): CriticalPreloadValue => {
  let base = '/';
  let engineWorkerFiles: readonly PreloadFileValue[] = [];

  const plugin: CriticalPreloadValue['plugin'] = {
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    name: 'skladburg:critical-preload',
    transformIndexHtml: {
      handler(html, context) {
        if (context.bundle === undefined) {
          return [];
        }

        const { chunks, gzipBytesByFileName } = readBundleChunks(context.bundle);
        const initialFileNames = collectImportClosure(findInitialRootFileNames(chunks, context.chunk), chunks);
        const linkedHrefs = readLinkedHrefs(html);
        const skippedFileNames = new Set([
          ...initialFileNames,
          ...chunks.map(chunk => chunk.fileName).filter(fileName => linkedHrefs.has(toPreloadHref(base, fileName))),
        ]);
        const plan = planCriticalPreload({
          chunks,
          entries,
          isDemoTransport,
          skippedFileNames,
          workerEntries,
          workerFileNames: engineWorkerFiles.map(file => file.fileName),
        });
        const workerGzipBytesByFileName = new Map(engineWorkerFiles.map(file => [file.fileName, file.gzipBytes]));

        console.log(
          '> createCriticalPreload -> transformIndexHtml:',
          createPreloadReport(
            plan.mainThreadFileNames.map(fileName => ({ fileName, gzipBytes: gzipBytesByFileName.get(fileName) ?? 0 })),
            plan.workerFileNames.map(fileName => ({ fileName, gzipBytes: workerGzipBytesByFileName.get(fileName) ?? 0 })),
          ),
        );

        return [
          ...createPreloadTags({ base, fileNames: plan.mainThreadFileNames, isLowPriority: false }),
          ...createPreloadTags({ base, fileNames: plan.workerFileNames, isLowPriority: true }),
        ];
      },
      order: 'post',
    },
  };

  const workerPlugin = (): ReturnType<CriticalPreloadValue['workerPlugin']> => ({
    generateBundle(_options, bundle) {
      const files = collectEngineWorkerFiles(bundle, workerEntries);

      if (files.length > 0) {
        engineWorkerFiles = files;
      }
    },
    name: 'skladburg:critical-preload-worker',
  });

  return { plugin, workerPlugin };
};
