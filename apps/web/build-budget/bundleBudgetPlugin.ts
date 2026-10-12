import type { Plugin } from 'vite';

import type {
  BudgetChunkValue,
  ForbiddenPackageViolationValue,
} from './bundleBudgetTypes.ts';

import { BYTES_PER_KILOBYTE } from './bundleBudgetConstants.ts';
import {
  createBudgetReport,
  createBudgetViolationMessage,
  createForbiddenPackageMessage,
} from './createBudgetMessages.ts';
import {
  assertValidForbiddenPackages,
  createForbiddenPackageMatcher,
  findForbiddenPackageViolations,
} from './forbiddenPackages.ts';
import { gzipSizeInBytes } from './gzipSizeInBytes.ts';
import { measureInitialBundles } from './measureInitialBundles.ts';

export interface BundleBudgetContextValue {
  error: (message: string) => never;
}

export type BundleBudgetOutputValue
  = | { code: string; fileName: string; imports: readonly string[]; isEntry: boolean; moduleIds: readonly string[]; type: 'chunk' }
    | { type: 'asset' };

export interface BundleBudgetPluginOptionsValue {
  forbiddenInitialPackages: readonly string[];
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
            isEntry: output.isEntry,
            moduleIds: output.moduleIds,
          },
        ]
      : [],
  );

const assertValidLimit = (maxInitialGzipKiloBytes: number): void => {
  if (!Number.isFinite(maxInitialGzipKiloBytes) || maxInitialGzipKiloBytes <= 0) {
    throw new Error(`Bundle budget must be a positive number of kilobytes, got ${String(maxInitialGzipKiloBytes)}`);
  }
};

export const bundleBudgetPlugin = (options: BundleBudgetPluginOptionsValue): BundleBudgetPluginValue => {
  assertValidLimit(options.maxInitialGzipKiloBytes);
  assertValidForbiddenPackages(options.forbiddenInitialPackages);

  const limitBytes = options.maxInitialGzipKiloBytes * BYTES_PER_KILOBYTE;
  const isForbiddenPackage = createForbiddenPackageMatcher(options.forbiddenInitialPackages);

  return {
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const budgetChunks = toBudgetChunks(bundle);
      const moduleIdsByFileName = new Map(budgetChunks.map(chunk => [chunk.fileName, chunk.moduleIds]));
      const initialBundles = measureInitialBundles(budgetChunks);
      const sizeViolations = initialBundles.filter(initialBundle => initialBundle.gzipBytes > limitBytes);
      const packageViolations: ForbiddenPackageViolationValue[] = initialBundles.flatMap(initialBundle =>
        findForbiddenPackageViolations(initialBundle, moduleIdsByFileName, isForbiddenPackage),
      );

      if (sizeViolations.length > 0 || packageViolations.length > 0) {
        this.error(
          [
            ...packageViolations.map(createForbiddenPackageMessage),
            ...sizeViolations.map(violation => createBudgetViolationMessage(violation, limitBytes)),
          ].join('\n'),
        );
      }

      for (const initialBundle of initialBundles) {
        console.log('> bundleBudgetPlugin -> generateBundle:', createBudgetReport(initialBundle, limitBytes));
      }
    },
    name: 'skladburg:bundle-budget',
  };
};
