import type {
  CriticalPreloadOptionsValue,
  CriticalPreloadValue,
  PreloadFileValue,
} from './criticalPreloadTypes.ts';
import type { BundleChunksValue } from './readBundleChunks.ts';

import { collectEngineWorkerBundle } from './collectEngineWorkerBundle.ts';
import { collectImportClosure } from './collectImportClosure.ts';
import { createDeferredPreloadScript } from './createDeferredPreloadScript.ts';
import { createPreloadReport } from './createPreloadReport.ts';
import {
  createInlineScriptTag,
  createPreloadTags,
  toPreloadHref,
} from './createPreloadTags.ts';
import { assertKnownHintPointKeys } from './hintPointKeys.ts';
import { markHighFetchPriority } from './markHighFetchPriority.ts';
import { planCriticalPreload } from './planCriticalPreload.ts';
import { readBundleChunks } from './readBundleChunks.ts';
import { readLinkedHrefs } from './readLinkedHrefs.ts';
import { readStylesheetHref } from './readStylesheetHref.ts';
import { resolveDeferredTriggerSelectors } from './resolveDeferredTrigger.ts';

const findInitialRootFileNames = (
  chunks: BundleChunksValue['chunks'],
  htmlChunk: undefined | { fileName: string },
): string[] =>
  htmlChunk === undefined ? chunks.filter(chunk => chunk.isEntry).map(chunk => chunk.fileName) : [htmlChunk.fileName];

export const createCriticalPreload = (options: CriticalPreloadOptionsValue): CriticalPreloadValue => {
  const {
    deferredEntries,
    entries,
    isDemoTransport,
    workerDynamicEntries,
    workerEntries,
  } = options;

  assertKnownHintPointKeys('deferredEntries', deferredEntries, { entries, workerDynamicEntries, workerEntries });

  let base = '/';
  let workerBundle: BundleChunksValue | undefined;

  const plugin: CriticalPreloadValue['plugin'] = {
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    name: 'skladburg:critical-preload',
    transformIndexHtml: {
      handler(html, context) {
        if (context.bundle === undefined) {
          return { html, tags: [] };
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
          deferredEntries,
          entries,
          isDemoTransport,
          skippedFileNames,
          workerChunks: workerBundle?.chunks ?? [],
          workerDynamicEntries,
          workerEntries,
        });
        const entryHref = context.chunk === undefined ? undefined : toPreloadHref(base, context.chunk.fileName);
        const prioritized = entryHref === undefined ? undefined : markHighFetchPriority(html, entryHref);

        if (entryHref !== undefined && prioritized?.hasEntryScript !== true) {
          throw new Error(`Critical preload: the page has no entry script with the address ${entryHref}`);
        }

        if (entryHref === undefined && plan.deferredFileNames.length > 0) {
          throw new Error('Critical preload: the page has no entry script to defer the hints after');
        }

        const gzipBytesOf = (fileName: string): number =>
          gzipBytesByFileName.get(fileName) ?? workerBundle?.gzipBytesByFileName.get(fileName) ?? 0;
        const toFile = (fileName: string): PreloadFileValue => ({ fileName, gzipBytes: gzipBytesOf(fileName) });
        const toHref = (fileName: string): string => toPreloadHref(base, fileName);
        const triggerSelectors = entryHref === undefined || plan.deferredFileNames.length === 0
          ? []
          : resolveDeferredTriggerSelectors({ entryHref, stylesheetHref: readStylesheetHref(html) });
        const deferredScript = triggerSelectors.length === 0
          ? undefined
          : createDeferredPreloadScript({
              hrefs: plan.deferredFileNames.map(toHref),
              triggerSelectors,
            });

        console.log(
          '> createCriticalPreload -> transformIndexHtml:',
          createPreloadReport({
            deferredFiles: plan.deferredFileNames.map(toFile),
            deferredTriggers: triggerSelectors,
            inlineScriptBytes: deferredScript === undefined ? 0 : Buffer.byteLength(deferredScript),
            mainThreadFiles: plan.mainThreadFileNames.map(toFile),
            workerFiles: plan.workerFileNames.map(toFile),
          }),
        );

        return {
          html: prioritized?.html ?? html,
          tags: [
            ...createPreloadTags({ base, fileNames: plan.mainThreadFileNames, isLowPriority: false }),
            ...createPreloadTags({ base, fileNames: plan.workerFileNames, isLowPriority: true }),
            ...deferredScript === undefined ? [] : [createInlineScriptTag(deferredScript)],
          ],
        };
      },
      order: 'post',
    },
  };

  const workerPlugin = (): ReturnType<CriticalPreloadValue['workerPlugin']> => ({
    generateBundle(_options, bundle) {
      const collected = collectEngineWorkerBundle(bundle, workerEntries);

      if (collected !== undefined) {
        workerBundle = collected;
      }
    },
    name: 'skladburg:critical-preload-worker',
  });

  return { plugin, workerPlugin };
};
