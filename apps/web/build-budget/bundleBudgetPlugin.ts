import type { Plugin } from 'vite';

import type { BudgetChunkValue } from './bundleBudgetTypes.ts';

import { BYTES_PER_KILOBYTE } from './bundleBudgetConstants.ts';
import {
  createBudgetReport,
  createBudgetViolationMessage,
} from './createBudgetMessages.ts';
import { gzipSizeInBytes } from './gzipSizeInBytes.ts';
import { measureInitialBundles } from './measureInitialBundles.ts';

export interface BundleBudgetContextValue {
  error: (message: string) => never;
}

export type BundleBudgetOutputValue
  = | { code: string; fileName: string; imports: readonly string[]; isEntry: boolean; type: 'chunk' }
    | { type: 'asset' };

export interface BundleBudgetPluginOptionsValue {
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

  const limitBytes = options.maxInitialGzipKiloBytes * BYTES_PER_KILOBYTE;

  return {
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const initialBundles = measureInitialBundles(toBudgetChunks(bundle));
      const violations = initialBundles.filter(initialBundle => initialBundle.gzipBytes > limitBytes);

      if (violations.length > 0) {
        this.error(violations.map(violation => createBudgetViolationMessage(violation, limitBytes)).join('\n'));
      }

      for (const initialBundle of initialBundles) {
        console.log('> bundleBudgetPlugin -> generateBundle:', createBudgetReport(initialBundle, limitBytes));
      }
    },
    name: 'skladburg:bundle-budget',
  };
};
