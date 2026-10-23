import type { Dirent } from 'node:fs';

import {
  readdirSync,
  statSync,
} from 'node:fs';
import {
  extname,
  join,
} from 'node:path';

import type {
  AssetBudgetFileValue,
  AssetBudgetMeasurementValue,
  AssetBudgetValue,
} from './bundleBudgetTypes.ts';

const collectFiles = (directory: string, prefix: string): AssetBudgetFileValue[] => {
  let entries: Dirent[];

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  }
  catch {
    return [];
  }

  return entries
    .toSorted((current, next) => current.name.localeCompare(next.name))
    .flatMap((entry) => {
      const entryPath = join(directory, entry.name);
      const fileName = prefix === '' ? entry.name : `${prefix}/${entry.name}`;

      return entry.isDirectory()
        ? collectFiles(entryPath, fileName)
        : [{ bytes: statSync(entryPath).size, fileName }];
    });
};

export const measureAssetBudget = (outDir: string, budget: AssetBudgetValue): AssetBudgetMeasurementValue => {
  const extensions = new Set(budget.extensions.map(extension => extension.toLowerCase()));
  const files = collectFiles(join(outDir, budget.directory), budget.directory).filter(file =>
    extensions.has(extname(file.fileName).toLowerCase()),
  );

  return {
    budget,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    files,
  };
};

export const assertValidAssetBudgets = (budgets: readonly AssetBudgetValue[]): void => {
  for (const budget of budgets) {
    if (budget.name.trim() === '') {
      throw new Error('Asset budget needs a non-empty name');
    }

    if (budget.directory.trim() === '') {
      throw new Error(`Asset budget "${budget.name}" needs a non-empty directory`);
    }

    if (budget.extensions.length === 0 || budget.extensions.some(extension => !extension.startsWith('.') || extension === '.')) {
      throw new Error(`Asset budget "${budget.name}" needs at least one extension and each must start with a dot`);
    }

    if (!Number.isFinite(budget.maxKiloBytes) || budget.maxKiloBytes <= 0) {
      throw new Error(
        `Asset budget "${budget.name}" must be a positive number of kilobytes, got ${String(budget.maxKiloBytes)}`,
      );
    }
  }
};
