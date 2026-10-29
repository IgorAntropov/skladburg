import type { Plugin } from 'vite';

import { resolve } from 'node:path';

import type {
  AssetBudgetValue,
  BudgetChunkValue,
  ForbiddenPackageViolationValue,
  LazyBudgetMeasurementValue,
  LazyEntryBudgetValue,
} from './bundleBudgetTypes.ts';

import { BYTES_PER_KILOBYTE } from './bundleBudgetConstants.ts';
import {
  createAnyChunkForbiddenPackageMessage,
  createAssetBudgetReport,
  createAssetBudgetViolationMessage,
  createBudgetReport,
  createBudgetViolationMessage,
  createForbiddenPackageMessage,
  createIncompleteBaselineMessage,
  createLazyBudgetForbiddenPackageMessage,
  createLazyBudgetReport,
  createLazyBudgetViolationMessage,
  createMissingAssetMessage,
  createMissingLazyEntryMessage,
} from './createBudgetMessages.ts';
import {
  assertValidForbiddenPackages,
  createForbiddenPackageMatcher,
  findForbiddenPackagesInChunks,
  findForbiddenPackageViolations,
} from './forbiddenPackages.ts';
import { gzipSizeInBytes } from './gzipSizeInBytes.ts';
import { hasEntryChunk } from './isEntryModule.ts';
import {
  assertValidAssetBudgets,
  measureAssetBudget,
} from './measureAssetBudget.ts';
import { measureInitialBundles } from './measureInitialBundles.ts';
import {
  assertValidLazyEntryBudgets,
  findBaselineBudget,
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
  assetBudgets?: readonly AssetBudgetValue[];
  forbiddenInitialPackages: readonly string[];
  forbiddenPackages?: readonly string[];
  lazyEntryBudgets?: readonly LazyEntryBudgetValue[];
  maxInitialGzipKiloBytes: number;
  targetEntries?: readonly string[];
}

export type BundleBudgetPluginValue = Omit<Plugin, 'configResolved' | 'generateBundle' | 'writeBundle'> & {
  configResolved: (config: BundleBudgetResolvedConfigValue) => void;
  generateBundle: (
    this: BundleBudgetContextValue,
    options: unknown,
    bundle: Readonly<Record<string, BundleBudgetOutputValue>>,
  ) => void;
  writeBundle: (this: BundleBudgetContextValue) => void;
};

export interface BundleBudgetResolvedConfigValue {
  build: { outDir: string };
  root: string;
}

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

const isTargetBundle = (chunks: readonly BudgetChunkValue[], targetEntries: readonly string[]): boolean =>
  targetEntries.length === 0 || hasEntryChunk(chunks, targetEntries);

const findLazyBudgetForbiddenPackageMessages = (
  measurement: LazyBudgetMeasurementValue,
  budgetChunks: readonly BudgetChunkValue[],
): string[] => {
  const forbiddenPackages = measurement.budget.forbiddenPackages ?? [];

  if (forbiddenPackages.length === 0) {
    return [];
  }

  const measuredFileNames = new Set(measurement.chunks.map(chunk => chunk.fileName));
  const measuredChunks = budgetChunks.filter(chunk => measuredFileNames.has(chunk.fileName));

  return findForbiddenPackagesInChunks(measuredChunks, createForbiddenPackageMatcher(forbiddenPackages)).map(violation =>
    createLazyBudgetForbiddenPackageMessage(measurement.budget.name, violation),
  );
};

const assertValidLimit = (maxInitialGzipKiloBytes: number): void => {
  if (!Number.isFinite(maxInitialGzipKiloBytes) || maxInitialGzipKiloBytes <= 0) {
    throw new Error(`Bundle budget must be a positive number of kilobytes, got ${String(maxInitialGzipKiloBytes)}`);
  }
};

export const bundleBudgetPlugin = (options: BundleBudgetPluginOptionsValue): BundleBudgetPluginValue => {
  const lazyEntryBudgets = options.lazyEntryBudgets ?? [];
  const assetBudgets = options.assetBudgets ?? [];
  const targetEntries = options.targetEntries ?? [];
  let outDir = '';

  assertValidLimit(options.maxInitialGzipKiloBytes);
  assertValidForbiddenPackages(options.forbiddenInitialPackages);
  assertValidForbiddenPackages(options.forbiddenPackages ?? []);
  assertValidLazyEntryBudgets(lazyEntryBudgets);
  assertValidAssetBudgets(assetBudgets);

  const limitBytes = toBytes(options.maxInitialGzipKiloBytes);
  const isForbiddenInitialPackage = createForbiddenPackageMatcher(options.forbiddenInitialPackages);
  const isForbiddenPackage = createForbiddenPackageMatcher(options.forbiddenPackages ?? []);

  return {
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    enforce: 'post',
    generateBundle(_options, bundle) {
      const budgetChunks = toBudgetChunks(bundle);

      if (!isTargetBundle(budgetChunks, targetEntries)) {
        return;
      }

      const moduleIdsByFileName = new Map(budgetChunks.map(chunk => [chunk.fileName, chunk.moduleIds]));
      const initialBundles = measureInitialBundles(budgetChunks);
      const sizeViolations = initialBundles.filter(initialBundle => initialBundle.gzipBytes > limitBytes);
      const packageViolations: ForbiddenPackageViolationValue[] = initialBundles.flatMap(initialBundle =>
        findForbiddenPackageViolations(initialBundle, moduleIdsByFileName, isForbiddenInitialPackage),
      );
      const anyChunkPackageViolations = findForbiddenPackagesInChunks(budgetChunks, isForbiddenPackage);
      const lazyMeasurements = lazyEntryBudgets.map(budget =>
        measureLazyBudget(budgetChunks, initialBundles, budget, findBaselineBudget(lazyEntryBudgets, budget)),
      );
      const lazySizeViolations = lazyMeasurements.filter(
        measurement => measurement.gzipBytes > toBytes(measurement.budget.maxGzipKiloBytes),
      );
      const lazyForbiddenPackageMessages = lazyMeasurements.flatMap(measurement =>
        findLazyBudgetForbiddenPackageMessages(measurement, budgetChunks),
      );
      const missingEntries = lazyMeasurements.flatMap(measurement =>
        measurement.missingEntries.map(entry => ({
          isRequired: measurement.budget.isRequired === true,
          message: createMissingLazyEntryMessage(measurement.budget.name, entry),
        })),
      );
      const requiredMissingMessages = missingEntries.filter(missing => missing.isRequired).map(missing => missing.message);
      const incompleteBaselineMessages = lazyMeasurements.flatMap(measurement =>
        measurement.baselineMissingEntries.length > 0 && measurement.budget.baseline !== undefined
          ? [createIncompleteBaselineMessage(measurement.budget.name, measurement.budget.baseline)]
          : [],
      );

      if (
        sizeViolations.length > 0
        || packageViolations.length > 0
        || anyChunkPackageViolations.length > 0
        || lazyForbiddenPackageMessages.length > 0
        || lazySizeViolations.length > 0
        || requiredMissingMessages.length > 0
      ) {
        this.error(
          [
            ...packageViolations.map(createForbiddenPackageMessage),
            ...anyChunkPackageViolations.map(createAnyChunkForbiddenPackageMessage),
            ...lazyForbiddenPackageMessages,
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

      for (const message of [...missingEntries.map(missing => missing.message), ...incompleteBaselineMessages]) {
        console.warn('> bundleBudgetPlugin -> generateBundle:', message);
      }
    },
    name: 'skladburg:bundle-budget',
    writeBundle() {
      const measurements = assetBudgets.map(budget => measureAssetBudget(outDir, budget));
      const violationMessages = measurements.flatMap((measurement) => {
        if (measurement.files.length === 0) {
          return measurement.budget.isRequired ? [createMissingAssetMessage(measurement.budget)] : [];
        }

        const limitBytes = toBytes(measurement.budget.maxKiloBytes);

        return measurement.bytes > limitBytes ? [createAssetBudgetViolationMessage(measurement, limitBytes)] : [];
      });

      if (violationMessages.length > 0) {
        this.error(violationMessages.join('\n'));
      }

      for (const measurement of measurements) {
        if (measurement.files.length > 0) {
          console.log(
            '> bundleBudgetPlugin -> writeBundle:',
            createAssetBudgetReport(measurement, toBytes(measurement.budget.maxKiloBytes)),
          );
        }
      }
    },
  };
};
