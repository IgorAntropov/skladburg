import type { Plugin } from 'vite';

import type {
  BudgetChunkValue,
  ForbiddenPackageViolationValue,
  LazyEntryBudgetValue,
} from './bundleBudgetTypes.ts';

import { BYTES_PER_KILOBYTE } from './bundleBudgetConstants.ts';
import {
  createAnyChunkForbiddenPackageMessage,
  createBudgetReport,
  createBudgetViolationMessage,
  createForbiddenPackageMessage,
  createLazyBudgetReport,
  createLazyBudgetViolationMessage,
  createMissingLazyEntryMessage,
} from './createBudgetMessages.ts';
import {
  assertValidForbiddenPackages,
  createForbiddenPackageMatcher,
  findForbiddenPackagesInChunks,
  findForbiddenPackageViolations,
} from './forbiddenPackages.ts';
import { gzipSizeInBytes } from './gzipSizeInBytes.ts';
import { measureInitialBundles } from './measureInitialBundles.ts';
import {
  assertValidLazyEntryBudgets,
  measureLazyBudget,
} from './measureLazyBudget.ts';

export interface BundleBudgetContextValue {
  error: (message: string) => never;
}

export type BundleBudgetOutputValue
  = | {
    code: string;
    fileName: string;
    imports: readonly string[];
    isDynamicEntry: boolean;
    isEntry: boolean;
    moduleIds: readonly string[];
    type: 'chunk';
  }
  | { type: 'asset' };

export interface BundleBudgetPluginOptionsValue {
  forbiddenInitialPackages: readonly string[];
  forbiddenPackages?: readonly string[];
  lazyEntryBudgets?: readonly LazyEntryBudgetValue[];
  maxInitialGzipKiloBytes: number;
}

export type BundleBudgetPluginValue = Omit<Plugin, 'generateBundle'> & {
  generateBundle: (
    this: BundleBudgetContextValue,
    options: unknown,
    bundle: Readonly<Record<string, BundleBudgetOutputValue>>,
  ) => void;
};

const toBudgetChunks = (bundle: Readonly<Record<string, BundleBudgetOutputValue>>): BudgetChunkValue[] =>
  Object.values(bundle).flatMap(output =>
    output.type === 'chunk'
      ? [
          {
            fileName: output.fileName,
            gzipBytes: gzipSizeInBytes(output.code),
            imports: output.imports,
            isDynamicEntry: output.isDynamicEntry,
            isEntry: output.isEntry,
            moduleIds: output.moduleIds,
          },
        ]
      : [],
  );

const toBytes = (kiloBytes: number): number => kiloBytes * BYTES_PER_KILOBYTE;

const assertValidLimit = (maxInitialGzipKiloBytes: number): void => {
  if (!Number.isFinite(maxInitialGzipKiloBytes) || maxInitialGzipKiloBytes <= 0) {
    throw new Error(`Bundle budget must be a positive number of kilobytes, got ${String(maxInitialGzipKiloBytes)}`);
  }
};

export const bundleBudgetPlugin = (options: BundleBudgetPluginOptionsValue): BundleBudgetPluginValue => {
  const lazyEntryBudgets = options.lazyEntryBudgets ?? [];

  assertValidLimit(options.maxInitialGzipKiloBytes);
  assertValidForbiddenPackages(options.forbiddenInitialPackages);
  assertValidForbiddenPackages(options.forbiddenPackages ?? []);
  assertValidLazyEntryBudgets(lazyEntryBudgets);

  const limitBytes = toBytes(options.maxInitialGzipKiloBytes);
  const isForbiddenInitialPackage = createForbiddenPackageMatcher(options.forbiddenInitialPackages);
  const isForbiddenPackage = createForbiddenPackageMatcher(options.forbiddenPackages ?? []);

  return {
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const budgetChunks = toBudgetChunks(bundle);
      const moduleIdsByFileName = new Map(budgetChunks.map(chunk => [chunk.fileName, chunk.moduleIds]));
      const initialBundles = measureInitialBundles(budgetChunks);
      const sizeViolations = initialBundles.filter(initialBundle => initialBundle.gzipBytes > limitBytes);
      const packageViolations: ForbiddenPackageViolationValue[] = initialBundles.flatMap(initialBundle =>
        findForbiddenPackageViolations(initialBundle, moduleIdsByFileName, isForbiddenInitialPackage),
      );
      const anyChunkPackageViolations = findForbiddenPackagesInChunks(budgetChunks, isForbiddenPackage);
      const lazyMeasurements = lazyEntryBudgets.map(budget => measureLazyBudget(budgetChunks, initialBundles, budget));
      const lazySizeViolations = lazyMeasurements.filter(
        measurement => measurement.gzipBytes > toBytes(measurement.budget.maxGzipKiloBytes),
      );
      const missingEntries = lazyMeasurements.flatMap(measurement =>
        measurement.missingEntries.map(entry => ({
          isRequired: measurement.budget.isRequired === true,
          message: createMissingLazyEntryMessage(measurement.budget.name, entry),
        })),
      );
      const requiredMissingMessages = missingEntries.filter(missing => missing.isRequired).map(missing => missing.message);

      if (
        sizeViolations.length > 0
        || packageViolations.length > 0
        || anyChunkPackageViolations.length > 0
        || lazySizeViolations.length > 0
        || requiredMissingMessages.length > 0
      ) {
        this.error(
          [
            ...packageViolations.map(createForbiddenPackageMessage),
            ...anyChunkPackageViolations.map(createAnyChunkForbiddenPackageMessage),
            ...sizeViolations.map(violation => createBudgetViolationMessage(violation, limitBytes)),
            ...lazySizeViolations.map(violation =>
              createLazyBudgetViolationMessage(violation, toBytes(violation.budget.maxGzipKiloBytes)),
            ),
            ...requiredMissingMessages,
          ].join('\n'),
        );
      }

      for (const initialBundle of initialBundles) {
        console.log('> bundleBudgetPlugin -> generateBundle:', createBudgetReport(initialBundle, limitBytes));
      }

      for (const measurement of lazyMeasurements) {
        if (measurement.chunks.length > 0) {
          console.log(
            '> bundleBudgetPlugin -> generateBundle:',
            createLazyBudgetReport(measurement, toBytes(measurement.budget.maxGzipKiloBytes)),
          );
        }
      }

      for (const missing of missingEntries) {
        console.warn('> bundleBudgetPlugin -> generateBundle:', missing.message);
      }
    },
    name: 'skladburg:bundle-budget',
  };
};
