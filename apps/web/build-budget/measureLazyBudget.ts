import type {
  BudgetChunkValue,
  InitialBundleChunkValue,
  InitialBundleValue,
  LazyBudgetMeasurementValue,
  LazyEntryBudgetValue,
} from './bundleBudgetTypes.ts';

import { normalizeModuleId } from './extractPackageName.ts';
import { assertValidForbiddenPackages } from './forbiddenPackages.ts';

const isEntryModule = (moduleId: string, entry: string): boolean =>
  normalizeModuleId(moduleId).endsWith(`/${entry}`);

const findDynamicEntryChunks = (chunks: readonly BudgetChunkValue[], entry: string): BudgetChunkValue[] =>
  chunks.filter(chunk => chunk.isDynamicEntry && chunk.moduleIds.some(moduleId => isEntryModule(moduleId, entry)));

const collectInitialFileNames = (initialBundles: readonly InitialBundleValue[]): Set<string> =>
  new Set(initialBundles.flatMap(initialBundle => initialBundle.chunks.map(chunk => chunk.fileName)));

interface LazyGraphValue {
  chunks: InitialBundleChunkValue[];
  missingEntries: string[];
}

const sumGzipBytes = (chunks: readonly InitialBundleChunkValue[]): number =>
  chunks.reduce((total, chunk) => total + chunk.gzipBytes, 0);

const collectLazyGraph = (
  chunks: readonly BudgetChunkValue[],
  excludedFileNames: ReadonlySet<string>,
  budget: LazyEntryBudgetValue,
): LazyGraphValue => {
  const chunksByFileName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
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

    if (chunk === undefined || visitedFileNames.has(chunk.fileName) || excludedFileNames.has(chunk.fileName)) {
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

  return { chunks: collected, missingEntries };
};

export const measureLazyBudget = (
  chunks: readonly BudgetChunkValue[],
  initialBundles: readonly InitialBundleValue[],
  budget: LazyEntryBudgetValue,
  baseline: LazyEntryBudgetValue | undefined,
): LazyBudgetMeasurementValue => {
  const initialFileNames = collectInitialFileNames(initialBundles);
  const graph = collectLazyGraph(chunks, initialFileNames, budget);
  const baselineGraph = baseline === undefined ? undefined : collectLazyGraph(chunks, initialFileNames, baseline);
  const baselineFileNames = new Set((baselineGraph?.chunks ?? []).map(chunk => chunk.fileName));
  const ownChunks = graph.chunks.filter(chunk => !baselineFileNames.has(chunk.fileName));

  return {
    baselineMissingEntries: baselineGraph?.missingEntries ?? [],
    budget,
    chunks: ownChunks,
    gzipBytes: sumGzipBytes(ownChunks),
    missingEntries: graph.missingEntries,
    totalGzipBytes: sumGzipBytes(graph.chunks),
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

    assertValidForbiddenPackages(budget.forbiddenPackages ?? []);
  }

  const budgetsByName = new Map(budgets.map(budget => [budget.name, budget]));

  if (budgetsByName.size !== budgets.length) {
    throw new Error('Lazy entry budgets need unique names');
  }

  for (const budget of budgets) {
    if (budget.baseline === undefined) {
      continue;
    }

    const baseline = budgetsByName.get(budget.baseline);

    if (baseline === undefined) {
      throw new Error(
        `Lazy entry budget "${budget.name}" has baseline "${budget.baseline}" that is not a lazy entry budget`,
      );
    }

    if (baseline === budget) {
      throw new Error(`Lazy entry budget "${budget.name}" cannot be its own baseline`);
    }

    if (baseline.baseline !== undefined) {
      throw new Error(
        [
          `Lazy entry budget "${budget.name}" has baseline "${baseline.name}"`,
          `that has its own baseline "${baseline.baseline}"; only one level is allowed`,
        ].join(' '),
      );
    }
  }
};

export const findBaselineBudget = (
  budgets: readonly LazyEntryBudgetValue[],
  budget: LazyEntryBudgetValue,
): LazyEntryBudgetValue | undefined =>
  budget.baseline === undefined ? undefined : budgets.find(candidate => candidate.name === budget.baseline);
