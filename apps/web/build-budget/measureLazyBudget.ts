import type {
  BudgetChunkValue,
  InitialBundleChunkValue,
  InitialBundleValue,
  LazyBudgetMeasurementValue,
  LazyEntryBudgetValue,
} from './bundleBudgetTypes.ts';

import { normalizeModuleId } from './extractPackageName.ts';

const isEntryModule = (moduleId: string, entry: string): boolean =>
  normalizeModuleId(moduleId).endsWith(`/${entry}`);

const findDynamicEntryChunks = (chunks: readonly BudgetChunkValue[], entry: string): BudgetChunkValue[] =>
  chunks.filter(chunk => chunk.isDynamicEntry && chunk.moduleIds.some(moduleId => isEntryModule(moduleId, entry)));

const collectInitialFileNames = (initialBundles: readonly InitialBundleValue[]): Set<string> =>
  new Set(initialBundles.flatMap(initialBundle => initialBundle.chunks.map(chunk => chunk.fileName)));

export const measureLazyBudget = (
  chunks: readonly BudgetChunkValue[],
  initialBundles: readonly InitialBundleValue[],
  budget: LazyEntryBudgetValue,
): LazyBudgetMeasurementValue => {
  const chunksByFileName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
  const initialFileNames = collectInitialFileNames(initialBundles);
  const visitedFileNames = new Set<string>();
  const collected: InitialBundleChunkValue[] = [];
  const missingEntries: string[] = [];
  const pending: BudgetChunkValue[] = [];

  for (const entry of budget.entries) {
    const entryChunks = findDynamicEntryChunks(chunks, entry);

    if (entryChunks.length === 0) {
      missingEntries.push(entry);
    }

    pending.push(...entryChunks);
  }

  while (pending.length > 0) {
    const chunk = pending.shift();

    if (chunk === undefined || visitedFileNames.has(chunk.fileName) || initialFileNames.has(chunk.fileName)) {
      continue;
    }

    visitedFileNames.add(chunk.fileName);
    collected.push({ fileName: chunk.fileName, gzipBytes: chunk.gzipBytes });

    for (const importedFileName of chunk.imports) {
      const imported = chunksByFileName.get(importedFileName);

      if (imported !== undefined) {
        pending.push(imported);
      }
    }
  }

  return {
    budget,
    chunks: collected,
    gzipBytes: collected.reduce((total, chunk) => total + chunk.gzipBytes, 0),
    missingEntries,
  };
};

export const assertValidLazyEntryBudgets = (budgets: readonly LazyEntryBudgetValue[]): void => {
  for (const budget of budgets) {
    if (budget.name.trim() === '') {
      throw new Error('Lazy entry budget needs a non-empty name');
    }

    if (budget.entries.length === 0 || budget.entries.some(entry => entry.trim() === '')) {
      throw new Error(`Lazy entry budget "${budget.name}" needs at least one entry and no blank entry`);
    }

    if (!Number.isFinite(budget.maxGzipKiloBytes) || budget.maxGzipKiloBytes <= 0) {
      throw new Error(
        `Lazy entry budget "${budget.name}" must be a positive number of kilobytes, got ${String(budget.maxGzipKiloBytes)}`,
      );
    }
  }
};
