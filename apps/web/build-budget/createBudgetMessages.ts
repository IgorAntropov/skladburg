import type {
  ChunkPackageViolationValue,
  ForbiddenPackageViolationValue,
  InitialBundleChunkValue,
  InitialBundleValue,
  LazyBudgetMeasurementValue,
} from './bundleBudgetTypes.ts';

import {
  formatKiloBytes,
  toKiloBytes,
} from './formatKiloBytes.ts';

export interface BudgetReportValue {
  chunks: string[];
  entry: string;
  headroomKiloBytes: number;
  initialGzipKiloBytes: number;
  limitKiloBytes: number;
}

export interface LazyBudgetReportValue {
  chunks: string[];
  entries: readonly string[];
  gzipKiloBytes: number;
  headroomKiloBytes: number;
  limitKiloBytes: number;
  name: string;
}

const describeChunkList = (chunks: readonly InitialBundleChunkValue[]): string[] =>
  chunks.map(chunk => `${chunk.fileName} ${formatKiloBytes(chunk.gzipBytes)}`);

const describeChunks = (bundle: InitialBundleValue): string[] => describeChunkList(bundle.chunks);

export const createBudgetReport = (bundle: InitialBundleValue, limitBytes: number): BudgetReportValue => ({
  chunks: describeChunks(bundle),
  entry: bundle.entryFileName,
  headroomKiloBytes: toKiloBytes(limitBytes - bundle.gzipBytes),
  initialGzipKiloBytes: toKiloBytes(bundle.gzipBytes),
  limitKiloBytes: toKiloBytes(limitBytes),
});

export const createBudgetViolationMessage = (bundle: InitialBundleValue, limitBytes: number): string => {
  const overshoot = formatKiloBytes(bundle.gzipBytes - limitBytes);

  return [
    `Initial JS of entry "${bundle.entryFileName}" is ${formatKiloBytes(bundle.gzipBytes)} gzip,`,
    `which exceeds the budget of ${formatKiloBytes(limitBytes)} by ${overshoot}.`,
    `Chunks loaded at startup: ${describeChunks(bundle).join(', ')}.`,
  ].join(' ');
};

export const createForbiddenPackageMessage = (violation: ForbiddenPackageViolationValue): string =>
  [
    `Package "${violation.packageName}" is bundled into the initial JS of entry "${violation.entryFileName}"`,
    `(chunk "${violation.chunkFileName}").`,
    'Load it through a dynamic import() so it stays out of the startup graph.',
  ].join(' ');

export const createAnyChunkForbiddenPackageMessage = (violation: ChunkPackageViolationValue): string =>
  [
    `Package "${violation.packageName}" is bundled into chunk "${violation.chunkFileName}".`,
    'It must not reach the production build; keep it behind a development-only condition.',
  ].join(' ');

export const createLazyBudgetReport = (
  measurement: LazyBudgetMeasurementValue,
  limitBytes: number,
): LazyBudgetReportValue => ({
  chunks: describeChunkList(measurement.chunks),
  entries: measurement.budget.entries,
  gzipKiloBytes: toKiloBytes(measurement.gzipBytes),
  headroomKiloBytes: toKiloBytes(limitBytes - measurement.gzipBytes),
  limitKiloBytes: toKiloBytes(limitBytes),
  name: measurement.budget.name,
});

export const createLazyBudgetViolationMessage = (measurement: LazyBudgetMeasurementValue, limitBytes: number): string => {
  const overshoot = formatKiloBytes(measurement.gzipBytes - limitBytes);

  return [
    `Lazy bundle "${measurement.budget.name}" loads ${formatKiloBytes(measurement.gzipBytes)} gzip outside the initial JS,`,
    `which exceeds the budget of ${formatKiloBytes(limitBytes)} by ${overshoot}.`,
    `Entries: ${measurement.budget.entries.join(', ')}.`,
    `Chunks: ${describeChunkList(measurement.chunks).join(', ')}.`,
  ].join(' ');
};

export const createLazyBudgetForbiddenPackageMessage = (
  budgetName: string,
  violation: ChunkPackageViolationValue,
): string =>
  [
    `Lazy bundle "${budgetName}": package "${violation.packageName}" is bundled into chunk "${violation.chunkFileName}".`,
    'This package is forbidden in this bundle; move the code that needs it out of the bundle or load it separately.',
  ].join(' ');

export const createMissingLazyEntryMessage = (budgetName: string, entry: string): string =>
  [
    `Lazy bundle "${budgetName}": module "${entry}" is not the entry of any dynamically imported chunk,`,
    'so its budget cannot be measured; fix the path in lazyEntryBudgets or load the module through import().',
  ].join(' ');
